import { createServer } from "node:http";

import { loadConfig } from "#/config.js";
import { getErrorMessage } from "#/errors.js";
import { createRequestHandler } from "#/http-handler.js";
import { createModel } from "#/model.js";

import type { Server } from "node:http";

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });
}

// Stops accepting new connections and lets in-flight requests finish before exiting.
function closeOnSignals(server: Server): void {
  const shutdown = (signal: string): void => {
    console.log(`${signal} received, shutting down...`);
    server.close();
    server.closeIdleConnections();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

async function run(): Promise<void> {
  const config = loadConfig();
  const model = createModel(config);
  const server = createServer(createRequestHandler(model));

  await listen(server, config.PORT, config.HOST);
  closeOnSignals(server);

  console.log(
    `${config.APP_NAME} (model: ${config.GEMINI_MODEL}) listening on http://${config.HOST}:${config.PORT}`,
  );
  console.log('POST /test-cases with a JSON body like {"userStory": "..."}');
}

async function main(): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exitCode = 1;
  }
}

await main();
