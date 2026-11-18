import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { createModel } from "#/ai/model.js";
import { generateTestCases } from "#/ai/test-generator.js";
import { readUserStory } from "#/cli/user-input.js";
import { loadConfig } from "#/shared/config.js";
import { getErrorMessage } from "#/shared/errors.js";

import type { LanguageModel, LanguageModelUsage } from "ai";

const EXIT_COMMAND = "exit";

function formatUsage(usage: LanguageModelUsage): string {
  return `(tokens: ${usage.inputTokens ?? "?"} in, ${usage.outputTokens ?? "?"} out)`;
}

// A failed story is reported and the loop goes on, so one bad API call doesn't end the session.
async function processStory(userStory: string, model: LanguageModel): Promise<void> {
  console.log("\nGenerating test cases...");
  try {
    const { text, usage } = await generateTestCases(userStory, model);
    console.log(`${formatUsage(usage)}\n`);
    console.log(text);
  } catch (error) {
    console.error(`Failed to generate test cases: ${getErrorMessage(error)}`);
  }
}

async function run(): Promise<void> {
  const config = loadConfig();
  const model = createModel(config);

  console.log(`${config.APP_NAME} (model: ${config.GEMINI_MODEL})`);
  console.log(`Type "${EXIT_COMMAND}" or press Ctrl+D to quit.`);

  const rl = createInterface({ input: stdin, output: stdout });
  const lines = rl[Symbol.asyncIterator]();

  try {
    for (;;) {
      console.log("\nEnter a user story. Press Enter on an empty line to finish:\n");
      const userStory = await readUserStory(lines);
      if (userStory === "" || userStory.toLowerCase() === EXIT_COMMAND) break;

      await processStory(userStory, model);
    }
  } finally {
    rl.close();
  }

  console.log("Bye!");
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
