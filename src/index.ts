import { stdin, stdout } from "node:process";

import { loadConfig } from "#/config.js";
import { createModel } from "#/model.js";
import { generateTestCases } from "#/test-cases.js";
import { readUserStory } from "#/user-input.js";

import type { LanguageModelUsage } from "ai";

function formatUsage(usage: LanguageModelUsage): string {
  return `(tokens: ${usage.inputTokens ?? "?"} in, ${usage.outputTokens ?? "?"} out)`;
}

async function run(): Promise<void> {
  const config = loadConfig();
  const model = createModel(config);

  console.log(`${config.APP_NAME} (model: ${config.GEMINI_MODEL})\n`);
  console.log("Enter a user story. Press Enter on an empty line to finish:\n");

  const userStory = await readUserStory(stdin, stdout);
  if (userStory === "") throw new Error("No user story entered. Nothing to do.");

  console.log("\nGenerating test cases...");
  const { text, usage } = await generateTestCases(userStory, model);

  console.log(`${formatUsage(usage)}\n`);
  console.log(text);
}

async function main(): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

await main();
