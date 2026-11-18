import { createInterface } from "node:readline/promises";

/**
 * Reads a (possibly multi-line) user story from a text stream.
 * The story ends at the first empty line, or when the stream ends (Ctrl+D in a terminal).
 * Leading empty lines are skipped. Returns "" if nothing was entered.
 *
 * The streams are parameters so the same function works with the terminal (process.stdin)
 * or with any other stream, e.g. one created in a test.
 */
export async function readUserStory(
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
): Promise<string> {
  const rl = createInterface({ input, output });

  const lines: string[] = [];
  for await (const line of rl) {
    if (line.trim() === "") {
      if (lines.length > 0) break;
      continue;
    }
    lines.push(line);
  }
  rl.close();

  return lines.join("\n").trim();
}
