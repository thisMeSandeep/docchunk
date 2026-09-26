// Maps every strategy name to its definition. Adding a strategy means adding one line here.
import type { StrategyName } from "../types";
import { fixedStrategy } from "./fixed";
import { fixedOverlapStrategy } from "./fixed-overlap";
import { headingStrategy } from "./heading";
import { hierarchicalStrategy } from "./hierarchical";
import { paragraphStrategy } from "./paragraph";
import { recursiveStrategy } from "./recursive";
import { sentenceStrategy } from "./sentence";
import { sentenceWindowStrategy } from "./sentence-window";
import { slidingWindowStrategy } from "./sliding-window";
import type { StrategyDefinition } from "./strategy-types";
import { structureStrategy } from "./structure";

// The mapped type makes a strategy name without an entry here a compile error.
export const strategyRegistry: { [Name in StrategyName]: StrategyDefinition<Name> } = {
  structure: structureStrategy,
  sentence: sentenceStrategy,
  paragraph: paragraphStrategy,
  heading: headingStrategy,
  "sentence-window": sentenceWindowStrategy,
  hierarchical: hierarchicalStrategy,
  fixed: fixedStrategy,
  "fixed-overlap": fixedOverlapStrategy,
  recursive: recursiveStrategy,
  "sliding-window": slidingWindowStrategy,
};
