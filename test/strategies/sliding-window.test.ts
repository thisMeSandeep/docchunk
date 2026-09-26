// Checks the sliding-window strategy's defaults, validation, and window positions.
import { describe, expect, it } from "vitest";
import type { DocumentIR } from "../../src/ir/ir-types";
import { slidingWindowStrategy } from "../../src/strategies/sliding-window";

/** Builds an IR for the sliding-window strategy, which reads only the Markdown. */
function buildIR(markdown: string): DocumentIR {
  return { markdown, blocks: [] };
}

describe("sliding-window strategy", () => {
  it("has the defaults from PRD 6.1", () => {
    expect(slidingWindowStrategy.defaults).toEqual({ size: 1500, step: 750, boundary: "word" });
  });

  it("moves each window forward by step characters", () => {
    const rawChunks = slidingWindowStrategy.split(buildIR("abcdefghij"), {
      size: 4,
      step: 2,
      boundary: "char",
    });
    expect(rawChunks).toEqual([
      { start: 0, end: 4 },
      { start: 2, end: 6 },
      { start: 4, end: 8 },
      { start: 6, end: 10 },
    ]);
  });

  it("does not overlap when step equals size", () => {
    const rawChunks = slidingWindowStrategy.split(buildIR("abcdefgh"), {
      size: 4,
      step: 4,
      boundary: "char",
    });
    expect(rawChunks).toEqual([
      { start: 0, end: 4 },
      { start: 4, end: 8 },
    ]);
  });

  it("rejects a step larger than size", () => {
    const validate = () =>
      slidingWindowStrategy.validate({ size: 100, step: 101, boundary: "word" });
    expect(validate).toThrow('Option "step" must be at most "size" (100), got 101.');
  });

  it("rejects a step that is not a positive integer", () => {
    const validate = () => slidingWindowStrategy.validate({ size: 100, step: 0, boundary: "word" });
    expect(validate).toThrow('Option "step" must be a positive integer, got 0.');
  });
});
