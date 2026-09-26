// Checks the recursive strategy: each split level, merging small pieces, overlap, and validation.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DocumentIR } from "../../src/ir/ir-types";
import { recursiveStrategy } from "../../src/strategies/recursive";

/** Splits the Markdown with the recursive strategy and returns the text of each range. */
function splitTexts(
  markdown: string,
  options: { size: number; overlapChars?: number; separators?: string[] },
): string[] {
  const ir: DocumentIR = { markdown, blocks: [] };
  const rawChunks = recursiveStrategy.split(ir, {
    size: options.size,
    overlapChars: options.overlapChars ?? 0,
    separators: options.separators ?? recursiveStrategy.defaults.separators,
  });
  const texts: string[] = [];
  for (const rawChunk of rawChunks) {
    texts.push(markdown.slice(rawChunk.start, rawChunk.end));
  }
  return texts;
}

describe("recursive strategy split levels", () => {
  it("has the defaults from PRD 6.1 and 6.2", () => {
    expect(recursiveStrategy.defaults).toEqual({
      size: 1500,
      overlapChars: 0,
      separators: ["\n# ", "\n## ", "\n### ", "\n#### ", "\n\n", "\n"],
    });
  });

  it("returns the whole document when it fits", () => {
    expect(splitTexts("Short text.", { size: 100 })).toEqual(["Short text."]);
  });

  it("splits at headings before blank lines", () => {
    const markdown = "# One\n\nFirst part.\n# Two\n\nSecond part.";
    expect(splitTexts(markdown, { size: 25 })).toEqual([
      "# One\n\nFirst part.",
      "\n# Two\n\nSecond part.",
    ]);
  });

  it("falls back to blank lines, then lines", () => {
    // "\n\nbbbb" is still too large, so it is split again at "\n". The whitespace-only piece is dropped later.
    expect(splitTexts("aaaa\n\nbbbb", { size: 5 })).toEqual(["aaaa", "\n", "\nbbbb"]);
    expect(splitTexts("aaaa\nbbbb", { size: 5 })).toEqual(["aaaa", "\nbbbb"]);
  });

  it("falls back to sentences when there are no line breaks", () => {
    expect(splitTexts("One two. Three four.", { size: 12 })).toEqual(["One two. ", "Three four."]);
  });

  it("falls back to spaces, then a hard cut", () => {
    expect(splitTexts("aaaa bbbb cccc", { size: 9 })).toEqual(["aaaa bbbb", " cccc"]);
    expect(splitTexts("abcdefghij", { size: 4 })).toEqual(["abcd", "efgh", "ij"]);
  });

  it("joins small neighboring pieces up to size", () => {
    const markdown = "a\n\nb\n\nc\n\nd";
    expect(splitTexts(markdown, { size: 7 })).toEqual(["a\n\nb\n\nc", "\n\nd"]);
  });

  it("keeps a hard cut from splitting an emoji", () => {
    expect(splitTexts("ab😀cd", { size: 3 })).toEqual(["ab", "😀c", "d"]);
  });

  it("uses custom separators before sentences and spaces", () => {
    const markdown = "part one|part two|part three";
    expect(splitTexts(markdown, { size: 12, separators: ["|"] })).toEqual([
      "part one",
      "|part two",
      "|part three",
    ]);
  });

  it("keeps every range within size on a long paragraph", () => {
    const markdown = readFileSync("test/fixtures/markdown/long-paragraph.md", "utf8");
    const texts = splitTexts(markdown, { size: 500 });
    expect(texts.length).toBeGreaterThan(1);
    for (const text of texts) {
      expect(text.length).toBeLessThanOrEqual(500);
    }
    expect(texts.join("")).toBe(markdown);
  });
});

describe("recursive strategy overlap", () => {
  it("repeats whole pieces from the end of the previous range", () => {
    const texts = splitTexts("aaaa bbbb cccc dddd", { size: 10, overlapChars: 5 });
    expect(texts).toEqual(["aaaa bbbb", " bbbb cccc", " cccc dddd"]);
  });

  it("repeats nothing when no piece fits in overlapChars", () => {
    const texts = splitTexts("aaaa bbbb cccc", { size: 9, overlapChars: 3 });
    expect(texts).toEqual(["aaaa bbbb", " cccc"]);
  });
});

describe("recursive strategy validation", () => {
  it("rejects separators that are not an array of non-empty strings", () => {
    for (const separators of [["\n", ""], "\n", [1]]) {
      // @ts-expect-error JavaScript callers can pass any value.
      const validate = () => recursiveStrategy.validate({ size: 100, overlapChars: 0, separators });
      expect(validate).toThrow('Option "separators" must be an array of non-empty strings');
    }
  });

  it("rejects overlapChars that is not smaller than size", () => {
    const validate = () =>
      recursiveStrategy.validate({ size: 10, overlapChars: 10, separators: ["\n"] });
    expect(validate).toThrow('Option "overlapChars" must be less than "size" (10), got 10.');
  });
});
