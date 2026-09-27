// The fixed-overlap strategy: like fixed, but consecutive chunks share `overlapChars` characters.
import { strategyDefaults } from "../config";
import {
  checkLessThan,
  checkNonNegativeInteger,
  checkOneOf,
  checkPositiveInteger,
} from "../options/option-checks";
import { cutAtSize } from "../splitting/cut-at-size";
import type { RawChunk, StrategyDefinition } from "./strategy-types";

export const fixedOverlapStrategy: StrategyDefinition<"fixed-overlap"> = {
  name: "fixed-overlap",
  defaults: strategyDefaults["fixed-overlap"],
  validate: (options) => {
    checkPositiveInteger("size", options.size);
    checkNonNegativeInteger("overlapChars", options.overlapChars);
    checkLessThan("overlapChars", options.overlapChars, "size", options.size);
    checkOneOf("boundary", options.boundary, ["word", "char"]);
  },
  split: (ir, options) => {
    const wholeDocument = { start: 0, end: ir.markdown.length };
    const pieces = cutAtSize(
      ir.markdown,
      wholeDocument,
      options.size,
      options.boundary,
      options.overlapChars,
    );
    const rawChunks: RawChunk[] = [];
    for (const piece of pieces) {
      rawChunks.push({ start: piece.start, end: piece.end });
    }
    return rawChunks;
  },
};
