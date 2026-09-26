// The structure strategy (the default): packs whole blocks into chunks up to `size`, never across a section.
import type { Block, DocumentIR } from "../ir/ir-types";
import { getSentenceUnits } from "../ir/sentence-units";
import {
  checkAtMost,
  checkIntegerBetween,
  checkLessThan,
  checkNonNegativeInteger,
  checkPositiveInteger,
} from "../options/option-checks";
import { measure } from "../output/measure";
import { addOverlap } from "../splitting/add-overlap";
import { mergeSmallChunks } from "../splitting/merge-small-chunks";
import { splitOversizedBlock } from "../splitting/split-oversized-block";
import type { SectionChunk, StrategyDefinition } from "./strategy-types";

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
    const packed = packBlocks(ir, options.size);
    const merged = mergeSmallChunks(packed, options.minSize, options.size);
    return addOverlap(merged, getSentenceUnits(ir), options.overlapChars, options.size);
  },
};

/** Packs blocks into chunks of at most `size`. A new chunk starts at each section, or when the next block does not fit. */
function packBlocks(ir: DocumentIR, size: number): SectionChunk[] {
  const chunks: SectionChunk[] = [];
  let current: SectionChunk | undefined;
  for (const block of ir.blocks) {
    // Each block is measured once, and the number is reused below.
    const blockSize = measure(block.start, block.end);
    if (blockSize > size) {
      addChunk(chunks, current);
      current = undefined;
      chunks.push(...splitBlockToSectionChunks(ir.markdown, block, size));
      continue;
    }
    const canJoinCurrent =
      current !== undefined &&
      current.sectionId === block.sectionId &&
      measure(current.start, block.end) <= size;
    if (current !== undefined && canJoinCurrent) {
      current.end = block.end;
      continue;
    }
    addChunk(chunks, current);
    current = { start: block.start, end: block.end, sectionId: block.sectionId };
  }
  addChunk(chunks, current);
  return chunks;
}

/** Splits a block that is larger than `size` with the oversize cascade, keeping its section id. */
function splitBlockToSectionChunks(markdown: string, block: Block, size: number): SectionChunk[] {
  const sectionChunks: SectionChunk[] = [];
  for (const piece of splitOversizedBlock(markdown, block, size)) {
    sectionChunks.push({ ...piece, sectionId: block.sectionId });
  }
  return sectionChunks;
}

/** Adds the chunk being built, if there is one. */
function addChunk(chunks: SectionChunk[], chunk: SectionChunk | undefined): void {
  if (chunk !== undefined) {
    chunks.push(chunk);
  }
}
