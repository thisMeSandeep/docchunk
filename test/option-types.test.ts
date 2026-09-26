// Checks at compile time that option types allow only valid combinations. `bun run typecheck` runs these checks.
import { describe, expectTypeOf, it } from "vitest";
import type { ChunkOptions, StrategyName } from "../src/index";
import type { ResolvedStrategyOptions, StrategyDefinition } from "../src/strategies/strategy-types";

describe("ChunkOptions", () => {
  it("accepts a strategy with its own options and the common options", () => {
    const options: ChunkOptions = {
      strategy: "fixed",
      size: 1000,
      boundary: "char",
      metadata: { team: "legal" },
      headingPrefix: true,
    };
    expectTypeOf(options).toExtend<ChunkOptions>();
  });

  it("rejects options that belong to another strategy", () => {
    const options: ChunkOptions = {
      strategy: "fixed",
      // @ts-expect-error overlapChars is not a fixed option.
      overlapChars: 200,
    };
    expectTypeOf(options).toExtend<ChunkOptions>();
  });

  it("rejects an unknown strategy name", () => {
    // @ts-expect-error "unknown" is not a strategy.
    const options: ChunkOptions = { strategy: "unknown" };
    expectTypeOf(options).toExtend<ChunkOptions>();
  });

  it("lists the registered strategy names", () => {
    expectTypeOf<StrategyName>().toEqualTypeOf<
      | "structure"
      | "sentence"
      | "paragraph"
      | "heading"
      | "sentence-window"
      | "hierarchical"
      | "fixed"
      | "fixed-overlap"
      | "recursive"
      | "sliding-window"
    >();
  });

  it("accepts structure options without a strategy name, and rejects other strategies' options there", () => {
    const defaultOptions: ChunkOptions = { size: 1000, minSize: 100, headingLevel: 2 };
    expectTypeOf(defaultOptions).toExtend<ChunkOptions>();
    // @ts-expect-error boundary is not a structure option, so it needs strategy "fixed".
    const wrongOptions: ChunkOptions = { boundary: "char" };
    expectTypeOf(wrongOptions).toExtend<ChunkOptions>();
  });
});

describe("StrategyDefinition", () => {
  it("gets options with every value filled in", () => {
    expectTypeOf<ResolvedStrategyOptions["fixed"]>().toEqualTypeOf<{
      size: number;
      boundary: "word" | "char";
    }>();
    expectTypeOf<StrategyDefinition<"fixed">["defaults"]>().toEqualTypeOf<
      ResolvedStrategyOptions["fixed"]
    >();
  });
});
