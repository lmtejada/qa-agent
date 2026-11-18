import { z } from "zod";

import { getErrorMessage } from "#/errors.js";
import { generateTestCases } from "#/test-cases.js";

import type { LanguageModel } from "ai";
import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";

const MAX_BODY_BYTES = 100_000;
const MAX_STORY_LENGTH = 10_000;

function createRequestSchema() {
  return z.object({
    userStory: z.string().trim().min(1).max(MAX_STORY_LENGTH),
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

// Returns undefined when the body is over the limit, so a huge upload can't exhaust memory.
async function readBody(req: IncomingMessage, maxBytes: number): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > maxBytes) return undefined;
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function handleGenerateTestCases(
  req: IncomingMessage,
  res: ServerResponse,
  model: LanguageModel,
): Promise<void> {
  const body = await readBody(req, MAX_BODY_BYTES);
  if (body === undefined) {
    sendJson(res, 413, { error: `Request body is larger than ${MAX_BODY_BYTES} bytes.` });
    return;
  }

  const parsed = createRequestSchema().safeParse(parseJson(body));
  if (!parsed.success) {
    sendJson(res, 400, {
      error: `Expected a JSON body like {"userStory": "..."} with 1 to ${MAX_STORY_LENGTH} characters.`,
    });
    return;
  }

  try {
    const { text, usage } = await generateTestCases(parsed.data.userStory, model);
    sendJson(res, 200, {
      testCases: text,
      usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
    });
  } catch (error) {
    // Details stay in the server log; clients get a generic message so nothing internal leaks.
    console.error(`Failed to generate test cases: ${getErrorMessage(error)}`);
    sendJson(res, 502, { error: "Failed to generate test cases." });
  }
}

async function routeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  model: LanguageModel,
): Promise<void> {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "POST" && req.url === "/test-cases") {
    await handleGenerateTestCases(req, res, model);
    return;
  }

  sendJson(res, 404, { error: "Not found. Use POST /test-cases or GET /health." });
}

function logRequest(req: IncomingMessage, res: ServerResponse, startedAt: number): void {
  console.log(`${req.method} ${req.url} ${res.statusCode} (${Date.now() - startedAt} ms)`);
}

export function createRequestHandler(model: LanguageModel): RequestListener {
  // Node's request listener can't be async, so the promise is handled here: any unexpected
  // error becomes a 500 instead of an unhandled rejection that would crash the server.
  return (req, res) => {
    const startedAt = Date.now();
    routeRequest(req, res, model)
      .catch((error: unknown) => {
        console.error(`Unexpected error: ${getErrorMessage(error)}`);
        if (!res.headersSent) sendJson(res, 500, { error: "Internal server error." });
      })
      .finally(() => logRequest(req, res, startedAt));
  };
}
