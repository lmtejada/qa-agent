import { createGoogleGenerativeAI } from "@ai-sdk/google";

import type { LanguageModel } from "ai";

export type GeminiOptions = {
  apiKey: string;
  modelId: string;
};

export function createGeminiModel({ apiKey, modelId }: GeminiOptions): LanguageModel {
  const google = createGoogleGenerativeAI({ apiKey });
  return google(modelId);
}
