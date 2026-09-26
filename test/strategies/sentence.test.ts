// Checks the sentence strategy: one chunk per unit, packing with a size, sections, and oversized units.
import { describe, expect, it } from "vitest";
import { type ChunkOptions, chunkDocument } from "../../src/index";
import { canonicalOptions } from "../../src/options/canonical-options";
import { resolveOptions } from "../../src/options/resolve-options";
import { sentenceStrategy } from "../../src/strategies/sentence";

/** Chunks Markdown with the sentence strategy and returns the chunk texts. */
async function sentenceTexts(
  content: string,
  sizeOptions: { size?: number; minSize?: number } = {},
): Promise<string[]> {
  const options: ChunkOptions = { strategy: "sentence", ...sizeOptions };
  const result = await chunkDocument({ content, format: "markdown" }, options);
  return result.chunks.map((chunk) => chunk.text);
}

describe("sentence strategy without a size", () => {
  it("makes one chunk per sentence and leaves headings out", async () => {
    const content = "# Title\n\nOne. Two three.\n\nFour.";
    expect(await sentenceTexts(content)).toEqual(["One.", "Two three.", "Four."]);
  });

  it("makes one chunk per list item, and one for each table and code block", async () => {
    const content = "- first\n- second\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```\ncode\n```";
    expect(await sentenceTexts(content)).toEqual([
      "- first",
      "- second",
      "| a | b |\n|---|---|\n| 1 | 2 |",
      "```\ncode\n```",
    ]);
  });

  it("stores no size limit as null in the canonical options", () => {
    const resolved = resolveOptions({ strategy: "sentence" });
    expect(canonicalOptions(resolved)).toContain('"size":null');
  });
});

describe("sentence strategy with a size", () => {
  it("packs consecutive sentences up to size", async () => {
    expect(await sentenceTexts("Aaa aa. Bbb bb. Ccc cc.", { size: 15 })).toEqual([
      "Aaa aa. Bbb bb.",
      "Ccc cc.",
    ]);
  });

  it("does not pack sentences from different sections", async () => {
    const content = "# One\n\nFirst. Second.\n\n# Two\n\nThird.";
    expect(await sentenceTexts(content, { size: 1000 })).toEqual(["First. Second.", "Third."]);
  });

  it("splits a sentence larger than size by words", async () => {
    expect(await sentenceTexts("alpha beta gamma delta.", { size: 12 })).toEqual([
      "alpha beta",
      "gamma delta.",
    ]);
  });

  it("splits a table larger than size by rows, repeating the header", async () => {
    const content = "| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |";
    expect(await sentenceTexts(content, { size: 30 })).toEqual([
      "| a | b |\n|---|---|\n| 1 | 2 |",
      "| a | b |\n|---|---|\n| 3 | 4 |",
    ]);
  });
});

describe("sentence strategy validation", () => {
  const defaults = sentenceStrategy.defaults;

  it("defaults to no size limit, no merging, and no overlap", () => {
    expect(defaults).toEqual({ size: Number.POSITIVE_INFINITY, minSize: 1, overlapChars: 0 });
  });

  it("rejects a size that is not a positive integer", () => {
    const validate = () => sentenceStrategy.validate({ ...defaults, size: 0 });
    expect(validate).toThrow('Option "size" must be a positive integer, got 0.');
  });

  it("rejects minSize larger than size", () => {
    const validate = () => sentenceStrategy.validate({ ...defaults, size: 50, minSize: 60 });
    expect(validate).toThrow('Option "minSize" must be at most "size" (50), got 60.');
  });
});
