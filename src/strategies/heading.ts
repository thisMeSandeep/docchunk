// The heading strategy: one chunk per section. With `size`, a larger section is split into packed blocks.
import { strategyDefaults } from "../config";
import { checkIntegerBetween, checkSizeOrNoLimit } from "../options/option-checks";
import { packBlocks } from "../splitting/pack-blocks";
import type { StrategyDefinition } from "./strategy-types";

export const headingStrategy: StrategyDefinition<"heading"> = {
  name: "heading",
  defaults: strategyDefaults.heading,
  validate: (options) => {
    checkSizeOrNoLimit("size", options.size);
    checkIntegerBetween("headingLevel", options.headingLevel, 1, 6);
  },
  // Sections come from headingLevel when the IR is built. With no size limit, packing puts each
  // whole section in one chunk; with a size, a larger section is split along its blocks (PRD 6.3).
  split: (ir, options) => packBlocks(ir.markdown, ir.blocks, options.size),
};
