// A framework README's `## Notes`: what porting the framework found it doing that a reader would
// not expect. It is a list and nothing else, because the framework's page shows each item and
// `rb check` requires at least one.

/** The heading the section starts at. */
export const NOTES_HEADING = "## Notes";

export interface Notes {
  /** Each item, its continuation lines joined to it by a space. */
  readonly items: readonly string[];
  /** The 1-based lines under the heading that are neither an item, its continuation, nor blank. */
  readonly stray: readonly number[];
}

/** The README's notes, or null when it has no `## Notes`. The section runs to the next `#` or `##` heading. */
export function notesOf(readme: string): Notes | null {
  const lines = readme.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trimEnd() === NOTES_HEADING);
  if (start < 0) return null;
  const items: string[] = [];
  const stray: number[] = [];
  for (let n = start + 1; n < lines.length; n++) {
    const line = lines[n]!;
    if (/^#{1,2} /.test(line)) break;
    if (line.startsWith("- ")) items.push(line.slice(2).trim());
    else if (/^\s+\S/.test(line) && items.length > 0) items[items.length - 1] += ` ${line.trim()}`;
    else if (line.trim() !== "") stray.push(n + 1);
  }
  return { items, stray };
}
