import { generateText } from "ai";

import {
  TEST_GENERATION_INSTRUCTIONS,
  buildTestGenerationPrompt,
} from "#/ai/prompts/test-generation.js";

import type { LanguageModel, LanguageModelUsage } from "ai";

export type TestCasesResult = {
  text: string;
  usage: LanguageModelUsage;
};

export async function generateTestCases(
  userStory: string,
  model: LanguageModel,
): Promise<TestCasesResult> {
  const result = await generateText({
    model,
    instructions: TEST_GENERATION_INSTRUCTIONS,
    prompt: buildTestGenerationPrompt(userStory),
  });

  return { text: result.text, usage: result.usage };
}
