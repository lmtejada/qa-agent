// Entry point: the only file that runs code on load. It wires the pieces together
// (config, model, terminal) and handles everything the user sees.
import { stdin, stdout } from "node:process";

import { createGoogleGenerativeAI } from "@ai-sdk/google";

import { config } from "#/config.js";
import { generateTestCases } from "#/test-cases.js";
import { readUserStory } from "#/user-input.js";

async function main(): Promise<void> {
  // The provider is the bridge between the AI SDK and Google's Gemini API.
  const google = createGoogleGenerativeAI({ apiKey: config.GOOGLE_GENERATIVE_AI_API_KEY });
  const model = google(config.GEMINI_MODEL);

  console.log(`${config.APP_NAME} (model: ${config.GEMINI_MODEL})\n`);
  console.log("Enter a user story. Press Enter on an empty line to finish:\n");

  const userStory = await readUserStory(stdin, stdout);
  if (userStory === "") {
    console.error("No user story entered. Nothing to do.");
    process.exitCode = 1;
    return;
  }

  console.log("\nGenerating test cases...");
  const { text, usage } = await generateTestCases(userStory, model);

  // Tokens are the units the model reads and writes (roughly ¾ of a word). They drive cost.
  console.log(`(tokens: ${usage.inputTokens ?? "?"} in, ${usage.outputTokens ?? "?"} out)\n`);
  console.log(text);
}

try {
  await main();
} catch (error) {
  // Network problems, an invalid API key or an unknown model name all end up here.
  console.error("Failed to generate test cases:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
