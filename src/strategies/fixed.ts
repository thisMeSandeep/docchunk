// The fixed strategy: cuts the Markdown every `size` characters, ignoring structure.
import { strategyDefaults } from "../config";
import { checkOneOf, checkPositiveInteger } from "../options/option-checks";
import { cutAtSize } from "../splitting/cut-at-size";
import type { RawChunk, StrategyDefinition } from "./strategy-types";

export const fixedStrategy: StrategyDefinition<"fixed"> = {
  name: "fixed",
  defaults: strategyDefaults.fixed,
  validate: (options) => {
    checkPositiveInteger("size", options.size);
    checkOneOf("boundary", options.boundary, ["word", "char"]);
  },
  split: (ir, options) => {
    const wholeDocument = { start: 0, end: ir.markdown.length };
    const pieces = cutAtSize(ir.markdown, wholeDocument, options.size, options.boundary);
    const rawChunks: RawChunk[] = [];
    for (const piece of pieces) {
      rawChunks.push({ start: piece.start, end: piece.end });
    }
    return rawChunks;
  },
};
