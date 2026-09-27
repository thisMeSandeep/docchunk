// The parent-child strategy: a two-level preset of hierarchical by size, with no algorithm of its own (PRD 6.2).
import { strategyDefaults } from "../config";
import { checkLessThan, checkPositiveInteger } from "../options/option-checks";
import { hierarchicalStrategy } from "./hierarchical";
import type { StrategyDefinition } from "./strategy-types";

export const parentChildStrategy: StrategyDefinition<"parent-child"> = {
  name: "parent-child",
  defaults: strategyDefaults["parent-child"],
  validate: (options) => {
    checkPositiveInteger("parentSize", options.parentSize);
    checkPositiveInteger("childSize", options.childSize);
    checkLessThan("childSize", options.childSize, "parentSize", options.parentSize);
  },
  split: (ir, options, signal) =>
    hierarchicalStrategy.split(
      ir,
      {
        ...hierarchicalStrategy.defaults,
        by: "size",
        levels: [options.parentSize, options.childSize],
      },
      signal,
    ),
};
