// Checks that every registry entry's name matches its key (PRD 11, item 5).
import { describe, expect, it } from "vitest";
import { strategyRegistry } from "../src/strategies/registry";

describe("strategyRegistry", () => {
  it("stores every strategy under its own name", () => {
    for (const [key, definition] of Object.entries(strategyRegistry)) {
      expect(definition.name).toBe(key);
    }
  });

  it("contains the strategies built so far", () => {
    expect(Object.keys(strategyRegistry)).toEqual(["fixed"]);
  });

  it("gives every strategy defaults that pass its own validation", () => {
    for (const definition of Object.values(strategyRegistry)) {
      expect(() => definition.validate(definition.defaults)).not.toThrow();
    }
  });
});
