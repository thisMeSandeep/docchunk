// Checks the fixed strategy's defaults, validation, and ranges.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DocchunkError } from "../../src/errors";
import type { DocumentIR } from "../../src/ir/ir-types";
import { fixedStrategy } from "../../src/strategies/fixed";

/** Builds an IR for the fixed strategy, which reads only the Markdown. */
function buildIR(markdown: string): DocumentIR {
  return { markdown, blocks: [] };
}

describe("fixed strategy", () => {
  it("has the defaults from PRD 6.1", () => {
    expect(fixedStrategy.defaults).toEqual({ size: 1500, boundary: "word" });
  });

  it("covers the whole document with ranges of at most size characters", () => {
    const markdown = readFileSync("test/fixtures/markdown/long-list.md", "utf8");
    const rawChunks = fixedStrategy.split(buildIR(markdown), fixedStrategy.defaults);
    expect(rawChunks.length).toBeGreaterThan(1);
    let previousEnd = 0;
    for (const rawChunk of rawChunks) {
      expect(rawChunk.start).toBe(previousEnd);
      expect(rawChunk.end - rawChunk.start).toBeLessThanOrEqual(1500);
      previousEnd = rawChunk.end;
    }
    expect(previousEnd).toBe(markdown.length);
  });

  it("returns no ranges for an empty document", () => {
    expect(fixedStrategy.split(buildIR(""), fixedStrategy.defaults)).toEqual([]);
  });

  it("accepts its defaults", () => {
    expect(() => fixedStrategy.validate(fixedStrategy.defaults)).not.toThrow();
  });

  it("rejects a size that is not a positive integer", () => {
    for (const size of [0, -5, 1.5, Number.NaN]) {
      const validate = () => fixedStrategy.validate({ size, boundary: "word" });
      expect(validate).toThrow(DocchunkError);
      expect(validate).toThrow('Option "size" must be a positive integer');
    }
  });

  it("rejects an unknown boundary", () => {
    // @ts-expect-error "sentence" is not a boundary; JavaScript callers can still pass it.
    const validate = () => fixedStrategy.validate({ size: 100, boundary: "sentence" });
    expect(validate).toThrow('Option "boundary" must be one of "word", "char", got sentence.');
  });

  it("throws errors with the INVALID_OPTIONS code", () => {
    try {
      fixedStrategy.validate({ size: 0, boundary: "word" });
    } catch (error) {
      expect(error).toBeInstanceOf(DocchunkError);
      expect(error instanceof DocchunkError && error.code).toBe("INVALID_OPTIONS");
      return;
    }
    throw new Error("validate did not throw");
  });
});
