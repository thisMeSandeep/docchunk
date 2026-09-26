// Checks the chunk count, sizes, and duration reported by buildStats.
import { describe, expect, it } from "vitest";
import { buildStats } from "../../src/output/build-stats";
import type { Chunk } from "../../src/types";

/** Builds a chunk with the given size. Only charCount matters for stats. */
function chunkOfSize(charCount: number): Chunk {
  return {
    id: "id",
    text: "x".repeat(charCount),
    index: 0,
    start: 0,
    end: charCount,
    charCount,
    headingPath: [],
    blockTypes: [],
    contentHash: "hash",
    metadata: {},
  };
}

describe("buildStats", () => {
  it("reports count, smallest, largest, and average size", () => {
    const chunks = [chunkOfSize(100), chunkOfSize(300), chunkOfSize(200)];
    expect(buildStats(chunks, 12)).toEqual({
      count: 3,
      minChars: 100,
      maxChars: 300,
      avgChars: 200,
      durationMs: 12,
    });
  });

  it("rounds the average to a whole number", () => {
    const chunks = [chunkOfSize(1), chunkOfSize(2)];
    expect(buildStats(chunks, 0).avgChars).toBe(2);
  });

  it("reports zeros when there are no chunks", () => {
    expect(buildStats([], 5)).toEqual({
      count: 0,
      minChars: 0,
      maxChars: 0,
      avgChars: 0,
      durationMs: 5,
    });
  });
});
