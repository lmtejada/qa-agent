import { readFile } from "node:fs/promises";

export type PromptName = "test-generation";

// prompts/ sits at the repo root, two levels up from both src/ai/ (tsx) and dist/ai/ (node),
// so the same relative URL works in development and in the build.
export async function loadPrompt(name: PromptName): Promise<string> {
  const url = new URL(`../../prompts/${name}.md`, import.meta.url);
  const text = await readFile(url, "utf8");
  return text.trim();
}
