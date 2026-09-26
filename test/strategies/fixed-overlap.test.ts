// Checks the fixed-overlap strategy's defaults, validation, and overlapping ranges.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DocumentIR } from "../../src/ir/ir-types";
import { fixedOverlapStrategy } from "../../src/strategies/fixed-overlap";

/** Builds an IR for the fixed-overlap strategy, which reads only the Markdown. */
function buildIR(markdown: string): DocumentIR {
  return { markdown, blocks: [] };
}

describe("fixed-overlap strategy", () => {
  it("has the defaults from PRD 6.1", () => {
    expect(fixedOverlapStrategy.defaults).toEqual({
      size: 1500,
      overlapChars: 200,
      boundary: "word",
    });
  });

  it("starts each range overlapChars before the previous range ends", () => {
    const rawChunks = fixedOverlapStrategy.split(buildIR("abcdefghij"), {
      size: 4,
      overlapChars: 1,
      boundary: "char",
    });
    expect(rawChunks).toEqual([
      { start: 0, end: 4 },
      { start: 3, end: 7 },
      { start: 6, end: 10 },
    ]);
  });

  it("keeps ranges within size and reaches the end of a long document", () => {
    const markdown = readFileSync("test/fixtures/markdown/long-paragraph.md", "utf8");
    const rawChunks = fixedOverlapStrategy.split(buildIR(markdown), fixedOverlapStrategy.defaults);
    expect(rawChunks.length).toBeGreaterThan(1);
    for (const rawChunk of rawChunks) {
      expect(rawChunk.end - rawChunk.start).toBeLessThanOrEqual(1500);
    }
    expect(rawChunks.at(-1)?.end).toBe(markdown.length);
  });

  it("behaves like fixed when overlapChars is 0", () => {
    const rawChunks = fixedOverlapStrategy.split(buildIR("abcdefghij"), {
      size: 4,
      overlapChars: 0,
      boundary: "char",
    });
    expect(rawChunks).toEqual([
      { start: 0, end: 4 },
      { start: 4, end: 8 },
      { start: 8, end: 10 },
    ]);
  });

  it("rejects overlapChars that is not smaller than size", () => {
    const validate = () =>
      fixedOverlapStrategy.validate({ size: 100, overlapChars: 100, boundary: "word" });
    expect(validate).toThrow('Option "overlapChars" must be less than "size" (100), got 100.');
  });

  it("rejects a negative or fractional overlapChars", () => {
    for (const overlapChars of [-1, 2.5]) {
      const validate = () =>
        fixedOverlapStrategy.validate({ size: 100, overlapChars, boundary: "word" });
      expect(validate).toThrow('Option "overlapChars" must be an integer of 0 or more');
    }
  });
});
