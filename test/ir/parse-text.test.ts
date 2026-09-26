// Checks that parseText splits plain text into paragraphs on blank lines.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeMarkdown } from "../../src/ir/normalize-markdown";
import { parseText } from "../../src/ir/parse-text";

/** Returns the text each block covers. */
function blockTexts(text: string): string[] {
  const texts: string[] = [];
  for (const block of parseText(text)) {
    texts.push(text.slice(block.start, block.end));
  }
  return texts;
}

describe("parseText", () => {
  it("splits the fixture into paragraphs and keeps Markdown characters as plain text", () => {
    const text = normalizeMarkdown(readFileSync("test/fixtures/text/plain-paragraphs.txt", "utf8"));
    expect(blockTexts(text)).toEqual([
      "# This is not a heading in plain text",
      "Second paragraph with *stars* and _underscores_ that stay as they are.\nIt continues on a second line.",
      "Third paragraph, after several blank lines.",
    ]);
  });

  it("makes every block a paragraph in section 0 with no heading path", () => {
    const blocks = parseText("# One\n\nTwo");
    for (const block of blocks) {
      expect(block.type).toBe("paragraph");
      expect(block.headingPath).toEqual([]);
      expect(block.sectionId).toBe(0);
    }
  });

  it("treats lines of only spaces or tabs as blank", () => {
    expect(blockTexts("first\n   \t\nsecond")).toEqual(["first", "second"]);
  });

  it("keeps leading spaces on the first line of a paragraph", () => {
    expect(blockTexts("\n\n  indented start\nnext line\n")).toEqual([
      "  indented start\nnext line",
    ]);
  });

  it("returns no blocks for empty or whitespace-only text", () => {
    expect(parseText("")).toEqual([]);
    expect(parseText("  \n\n\t\n")).toEqual([]);
  });

  it("handles text without a trailing newline", () => {
    expect(blockTexts("only line")).toEqual(["only line"]);
  });
});
