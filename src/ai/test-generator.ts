import { generateText } from "ai";

import { loadPrompt } from "#/ai/prompts.js";

import type { LanguageModel, LanguageModelUsage } from "ai";

export type TestCasesResult = {
  text: string;
  usage: LanguageModelUsage;
};

// The """ delimiters mark where the untrusted story starts and ends (see the prompt's rules).
export function buildPrompt(userStory: string): string {
  return `Write test cases for this user story:\n"""\n${userStory}\n"""`;
}

export async function generateTestCases(
  userStory: string,
  model: LanguageModel,
): Promise<TestCasesResult> {
  const result = await generateText({
    model,
    instructions: await loadPrompt("test-generation"),
    prompt: buildPrompt(userStory),
  });

  return { text: result.text, usage: result.usage };
}
