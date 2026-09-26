// The structure strategy (the default): packs whole blocks into chunks up to `size`, never across a section.
import { getSentenceUnits } from "../ir/sentence-units";
import {
  checkAtMost,
  checkIntegerBetween,
  checkLessThan,
  checkNonNegativeInteger,
  checkPositiveInteger,
} from "../options/option-checks";
import { addOverlap } from "../splitting/add-overlap";
import { mergeSmallChunks } from "../splitting/merge-small-chunks";
import { packBlocks } from "../splitting/pack-blocks";
import type { StrategyDefinition } from "./strategy-types";

export const structureStrategy: StrategyDefinition<"structure"> = {
  name: "structure",
  defaults: { size: 1500, minSize: 200, overlapChars: 0, headingLevel: 3 },
  validate: (options) => {
    checkPositiveInteger("size", options.size);
    checkPositiveInteger("minSize", options.minSize);
    checkAtMost("minSize", options.minSize, "size", options.size);
    checkNonNegativeInteger("overlapChars", options.overlapChars);
    checkLessThan("overlapChars", options.overlapChars, "size", options.size);
    checkIntegerBetween("headingLevel", options.headingLevel, 1, 6);
  },
  // headingLevel is used when the IR is built: it decides where sections start.
  split: (ir, options) => {
    const packed = packBlocks(ir.markdown, ir.blocks, options.size);
    const merged = mergeSmallChunks(packed, options.minSize, options.size);
    return addOverlap(merged, getSentenceUnits(ir), options.overlapChars, options.size);
  },
};
