import { createGoogleGenerativeAI } from "@ai-sdk/google";

import type { Config } from "#/shared/config.js";

import type { LanguageModel } from "ai";

export function createModel(config: Config): LanguageModel {
  const google = createGoogleGenerativeAI({ apiKey: config.GOOGLE_GENERATIVE_AI_API_KEY });
  return google(config.GEMINI_MODEL);
}
