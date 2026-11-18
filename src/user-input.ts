import { createInterface } from "node:readline/promises";

/**
 * Reads a multi-line user story. It ends at the first empty line after some text, or when the
 * stream ends (Ctrl+D). Returns "" if nothing was entered.
 */
export async function readUserStory(
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
): Promise<string> {
  const rl = createInterface({ input, output });

  const lines: string[] = [];
  for await (const line of rl) {
    const isEmpty = line.trim() === "";
    if (isEmpty && lines.length > 0) break;
    if (!isEmpty) lines.push(line);
  }
  rl.close();

  return lines.join("\n").trim();
}
