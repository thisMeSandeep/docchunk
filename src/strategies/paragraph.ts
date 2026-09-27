// The paragraph strategy: one chunk per block, with a heading kept with the block after it.
import { strategyDefaults } from "../config";
import type { Block } from "../ir/ir-types";
import { getSentenceUnits } from "../ir/sentence-units";
import {
  checkAtMost,
  checkLessThan,
  checkNonNegativeInteger,
  checkPositiveInteger,
  checkSizeOrNoLimit,
  noSizeLimit,
} from "../options/option-checks";
import { addOverlap } from "../splitting/add-overlap";
import { mergeSmallChunks } from "../splitting/merge-small-chunks";
import { buildBlockUnits, packBlocks } from "../splitting/pack-blocks";
import type { SectionChunk, StrategyDefinition } from "./strategy-types";

export const paragraphStrategy: StrategyDefinition<"paragraph"> = {
  name: "paragraph",
  defaults: strategyDefaults.paragraph,
  validate: (options) => {
    checkSizeOrNoLimit("size", options.size);
    checkPositiveInteger("minSize", options.minSize);
    checkAtMost("minSize", options.minSize, "size", options.size);
    checkNonNegativeInteger("overlapChars", options.overlapChars);
    checkLessThan("overlapChars", options.overlapChars, "size", options.size);
  },
  split: (ir, options) => {
    // Without a size, every block is its own chunk; with one, consecutive blocks are packed.
    const chunks =
      options.size === noSizeLimit
        ? oneChunkPerBlock(ir.blocks)
        : packBlocks(ir.markdown, ir.blocks, options.size);
    const merged = mergeSmallChunks(chunks, options.minSize, options.size);
    // Sentence units are only needed for overlap, so they are not computed without it.
    if (options.overlapChars === 0) {
      return merged;
    }
    return addOverlap(merged, getSentenceUnits(ir), options.overlapChars, options.size);
  },
};

/** Returns one chunk per block, with any headings joined to the block after them. */
function oneChunkPerBlock(blocks: Block[]): SectionChunk[] {
  const chunks: SectionChunk[] = [];
  for (const unit of buildBlockUnits(blocks)) {
    chunks.push({ start: unit.start, end: unit.end, sectionId: unit.sectionId });
  }
  return chunks;
}
