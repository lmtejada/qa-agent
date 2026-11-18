/**
 * Reads the next multi-line user story from a stream of lines. The story ends at the first empty
 * line after some text. Leading empty lines are skipped. Returns "" when the input has ended.
 *
 * It takes an iterator (not a stream) so it can be called repeatedly on the same input: lines
 * that arrive while the previous story is being processed stay buffered for the next call.
 */
export async function readUserStory(lines: AsyncIterator<string>): Promise<string> {
  const storyLines: string[] = [];

  for (;;) {
    const next = await lines.next();
    if (next.done === true) break;

    const isEmpty = next.value.trim() === "";
    if (isEmpty && storyLines.length > 0) break;
    if (!isEmpty) storyLines.push(next.value);
  }

  return storyLines.join("\n").trim();
}
