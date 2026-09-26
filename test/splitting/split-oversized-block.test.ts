// Checks the oversize cascade: each block type's splitter, prose by sentences then words then a hard cut, and grapheme safety.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Block } from "../../src/ir/ir-types";
import { normalizeMarkdown } from "../../src/ir/normalize-markdown";
import { parseMarkdown } from "../../src/ir/parse-markdown";
import { splitOversizedBlock } from "../../src/splitting/split-oversized-block";
import type { RawChunk } from "../../src/strategies/strategy-types";
import { firstBlockOfType, pieceText } from "./piece-text";

const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

/** Returns every offset in the text where a grapheme starts or ends. */
function graphemeBoundaries(text: string): Set<number> {
  const boundaries = new Set<number>([text.length]);
  for (const grapheme of graphemeSegmenter.segment(text)) {
    boundaries.add(grapheme.index);
  }
  return boundaries;
}

/** Returns the text of each piece. */
function pieceTexts(markdown: string, pieces: RawChunk[]): string[] {
  return pieces.map((piece) => pieceText(markdown, piece));
}

/** Checks every non-whitespace character of the block is inside some piece's range. */
function expectBlockCovered(markdown: string, block: Block, pieces: RawChunk[]): void {
  for (let index = block.start; index < block.end; index++) {
    const isWhitespace = /\s/.test(markdown.charAt(index));
    const isCovered = pieces.some((piece) => piece.start <= index && index < piece.end);
    if (!isWhitespace && !isCovered) {
      expect.fail(`Character ${index} (${markdown.charAt(index)}) is in no piece`);
    }
  }
}

describe("splitOversizedBlock picks the splitter for the block type", () => {
  it("splits tables by rows with the header repeated", () => {
    const markdown = "| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 |";
    const pieces = splitOversizedBlock(markdown, firstBlockOfType(markdown, "table"), 30);
    for (const text of pieceTexts(markdown, pieces)) {
      expect(text.startsWith("| A | B |\n|---|---|\n")).toBe(true);
    }
  });

  it("splits lists by items", () => {
    const markdown = "- first item\n- second item\n- third item";
    const pieces = splitOversizedBlock(markdown, firstBlockOfType(markdown, "list"), 26);
    expect(pieceTexts(markdown, pieces)).toEqual(["- first item\n- second item", "- third item"]);
  });

  it("splits code by lines inside the fence", () => {
    const markdown = "```\none\ntwo\nthree\n```";
    const pieces = splitOversizedBlock(markdown, firstBlockOfType(markdown, "code"), 16);
    for (const text of pieceTexts(markdown, pieces)) {
      expect(text.startsWith("```\n")).toBe(true);
      expect(text.endsWith("\n```")).toBe(true);
    }
  });
});

describe("splitOversizedBlock on prose", () => {
  it("splits a paragraph by sentences and groups them up to size", () => {
    const markdown = "One short. Two short. Three is here.";
    const pieces = splitOversizedBlock(markdown, firstBlockOfType(markdown, "paragraph"), 22);
    expect(pieceTexts(markdown, pieces)).toEqual(["One short. Two short.", "Three is here."]);
    expect(pieces.every((piece) => piece.isOversized !== true)).toBe(true);
  });

  it("splits a sentence that is too large by words", () => {
    const markdown = "alpha beta gamma delta epsilon";
    const pieces = splitOversizedBlock(markdown, firstBlockOfType(markdown, "paragraph"), 12);
    expect(pieceTexts(markdown, pieces)).toEqual(["alpha beta", "gamma delta", "epsilon"]);
  });

  it("hard-cuts a word that is too large and marks the pieces as oversized", () => {
    const markdown = `short ${"x".repeat(25)} end`;
    const pieces = splitOversizedBlock(markdown, firstBlockOfType(markdown, "paragraph"), 10);
    const oversized = pieces.filter((piece) => piece.isOversized === true);
    expect(pieceTexts(markdown, oversized)).toEqual(["xxxxxxxxxx", "xxxxxxxxxx", "xxxxx"]);
  });

  it("splits a heading and a blockquote as prose", () => {
    const markdown = "# A heading that is long\n\n> Quoted one. Quoted two.";
    const blocks = parseMarkdown(markdown, 3);
    for (const block of blocks) {
      const pieces = splitOversizedBlock(markdown, block, 14);
      for (const text of pieceTexts(markdown, pieces)) {
        expect(text.length).toBeLessThanOrEqual(14);
      }
      expectBlockCovered(markdown, block, pieces);
    }
  });
});

describe("splitOversizedBlock on Hindi, Japanese, and emoji", () => {
  const markdown = normalizeMarkdown(
    readFileSync("test/fixtures/markdown/multilingual.md", "utf8"),
  );
  const boundaries = graphemeBoundaries(markdown);
  const paragraphs = parseMarkdown(markdown, 3).filter((block) => block.type === "paragraph");

  it("keeps every piece within size, covers the text, and cuts only between graphemes", () => {
    expect(paragraphs).toHaveLength(3);
    for (const size of [5, 12, 30]) {
      for (const paragraph of paragraphs) {
        const pieces = splitOversizedBlock(markdown, paragraph, size);
        for (const piece of pieces) {
          const isSingleGrapheme =
            [...graphemeSegmenter.segment(pieceText(markdown, piece))].length === 1;
          if (!isSingleGrapheme) {
            expect(piece.end - piece.start).toBeLessThanOrEqual(size);
          }
          expect(boundaries.has(piece.start)).toBe(true);
          expect(boundaries.has(piece.end)).toBe(true);
        }
        expectBlockCovered(markdown, paragraph, pieces);
      }
    }
  });

  it("gives a family emoji larger than size a piece of its own", () => {
    const emojiParagraph = paragraphs[2];
    if (emojiParagraph === undefined) {
      throw new Error("Emoji paragraph missing");
    }
    const pieces = splitOversizedBlock(markdown, emojiParagraph, 5);
    expect(pieceTexts(markdown, pieces)).toContain("👨‍👩‍👧‍👦");
  });
});
