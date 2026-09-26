// The sliding-window strategy: a window of `size` characters that moves forward `step` characters at a time.
import { checkAtMost, checkOneOf, checkPositiveInteger } from "../options/option-checks";
import { fixedOverlapStrategy } from "./fixed-overlap";
import type { StrategyDefinition } from "./strategy-types";

export const slidingWindowStrategy: StrategyDefinition<"sliding-window"> = {
  name: "sliding-window",
  defaults: { size: 1500, step: 750, boundary: "word" },
  validate: (options) => {
    checkPositiveInteger("size", options.size);
    checkPositiveInteger("step", options.step);
    checkAtMost("step", options.step, "size", options.size);
    checkOneOf("boundary", options.boundary, ["word", "char"]);
  },
  // Moving forward by `step` is the same as overlapping each window by `size - step` (PRD 6.1).
  split: (ir, options) => {
    const overlapChars = options.size - options.step;
    return fixedOverlapStrategy.split(ir, {
      size: options.size,
      overlapChars,
      boundary: options.boundary,
    });
  },
};
