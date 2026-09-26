// Checks that every registry entry's name matches its key (PRD 11, item 5).
import { describe, expect, it } from "vitest";
import { resolveOptions } from "../src/options/resolve-options";
import { strategyRegistry } from "../src/strategies/registry";

describe("strategyRegistry", () => {
  it("stores every strategy under its own name", () => {
    for (const [key, definition] of Object.entries(strategyRegistry)) {
      expect(definition.name).toBe(key);
    }
  });

  it("contains the strategies built so far", () => {
    expect(Object.keys(strategyRegistry)).toEqual([
      "structure",
      "sentence",
      "paragraph",
      "heading",
      "sentence-window",
      "hierarchical",
      "fixed",
      "fixed-overlap",
      "recursive",
      "sliding-window",
    ]);
  });

  it("gives every strategy defaults that pass its own validation", () => {
    // resolveOptions runs the strategy's validate on the defaults when no other options are given.
    for (const strategyName of Object.keys(strategyRegistry)) {
      expect(() => resolveOptions({ strategy: strategyName })).not.toThrow();
    }
  });
});
