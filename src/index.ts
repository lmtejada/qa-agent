import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { config } from "#/config.js";
import { generateTestCases } from "#/test-cases.js";

// Reads a (possibly multi-line) user story from the terminal.
// The story ends at the first empty line, or when the user presses Ctrl+D.
async function readUserStory(): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  console.log("Enter a user story. Press Enter on an empty line to finish:\n");

  const lines: string[] = [];
  for await (const line of rl) {
    if (line.trim() === "") {
      if (lines.length > 0) break;
      continue; // ignore empty lines before the story starts
    }
    lines.push(line);
  }
  rl.close();

  return lines.join("\n").trim();
}

console.log(`${config.APP_NAME} (model: ${config.GEMINI_MODEL})\n`);

const userStory = await readUserStory();
if (userStory === "") {
  console.error("No user story entered. Nothing to do.");
  process.exit(1);
}

console.log("\nGenerating test cases...");

try {
  const testCases = await generateTestCases(userStory);
  console.log(testCases);
} catch (error) {
  // Network problems, an invalid API key or an unknown model name all end up here.
  console.error("Failed to generate test cases:", error instanceof Error ? error.message : error);
  process.exit(1);
}
