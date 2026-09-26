// Parses plain text into paragraph blocks separated by blank lines. No Markdown syntax is read.
import type { Block } from "./ir-types";

/** Returns one paragraph block per run of non-blank lines. */
export function parseText(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraphStart = -1;
  let paragraphEnd = -1;
  let lineStart = 0;
  while (lineStart <= text.length) {
    const newlineIndex = text.indexOf("\n", lineStart);
    const lineEnd = newlineIndex === -1 ? text.length : newlineIndex;
    const isBlankLine = text.slice(lineStart, lineEnd).trim() === "";
    if (isBlankLine && paragraphStart !== -1) {
      blocks.push(createParagraph(paragraphStart, paragraphEnd));
      paragraphStart = -1;
    }
    if (!isBlankLine && paragraphStart === -1) {
      paragraphStart = lineStart;
    }
    if (!isBlankLine) {
      paragraphEnd = lineEnd;
    }
    lineStart = lineEnd + 1;
  }
  if (paragraphStart !== -1) {
    blocks.push(createParagraph(paragraphStart, paragraphEnd));
  }
  return blocks;
}

/** Builds a paragraph block. Plain text has no headings, so every block is in section 0. */
function createParagraph(start: number, end: number): Block {
  return { type: "paragraph", start, end, headingPath: [], sectionId: 0 };
}
