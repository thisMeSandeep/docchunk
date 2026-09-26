// The sentence strategy: one chunk per sentence unit. With `size`, packs consecutive units in the same section.
import type { DocumentIR, Unit } from "../ir/ir-types";
import { getSentenceUnits } from "../ir/sentence-units";
import {
  checkAtMost,
  checkLessThan,
  checkNonNegativeInteger,
  checkPositiveInteger,
  checkSizeOrNoLimit,
  noSizeLimit,
} from "../options/option-checks";
import { measure } from "../output/measure";
import { addOverlap } from "../splitting/add-overlap";
import { mergeSmallChunks } from "../splitting/merge-small-chunks";
import { splitOversizedBlock, splitProse } from "../splitting/split-oversized-block";
import type { SectionChunk, StrategyDefinition } from "./strategy-types";

export const sentenceStrategy: StrategyDefinition<"sentence"> = {
  name: "sentence",
  defaults: { size: noSizeLimit, minSize: 1, overlapChars: 0 },
  validate: (options) => {
    checkSizeOrNoLimit("size", options.size);
    checkPositiveInteger("minSize", options.minSize);
    checkAtMost("minSize", options.minSize, "size", options.size);
    checkNonNegativeInteger("overlapChars", options.overlapChars);
    checkLessThan("overlapChars", options.overlapChars, "size", options.size);
  },
  split: (ir, options) => {
    const units = getSentenceUnits(ir);
    const packed = packUnits(ir, units, options.size);
    const merged = mergeSmallChunks(packed, options.minSize, options.size);
    return addOverlap(merged, units, options.overlapChars, options.size);
  },
};

/** Returns one chunk per unit, or with a size, consecutive units of one section packed up to `size`. */
function packUnits(ir: DocumentIR, units: Unit[], size: number): SectionChunk[] {
  const chunks: SectionChunk[] = [];
  let current: SectionChunk | undefined;
  for (const unit of units) {
    const sectionId = ir.blocks[unit.blockIndex]?.sectionId ?? 0;
    if (measure(unit.start, unit.end) > size) {
      addChunk(chunks, current);
      current = undefined;
      chunks.push(...splitUnit(ir, unit, sectionId, size));
      continue;
    }
    const canJoinCurrent =
      size !== noSizeLimit &&
      current !== undefined &&
      current.sectionId === sectionId &&
      measure(current.start, unit.end) <= size;
    if (current !== undefined && canJoinCurrent) {
      current.end = unit.end;
      continue;
    }
    addChunk(chunks, current);
    current = { start: unit.start, end: unit.end, sectionId };
  }
  addChunk(chunks, current);
  return chunks;
}

/** Splits a unit larger than `size`: a sentence by words, a table or code block with the oversize cascade. */
function splitUnit(ir: DocumentIR, unit: Unit, sectionId: number, size: number): SectionChunk[] {
  const block = ir.blocks[unit.blockIndex];
  const pieces =
    unit.kind === "sentence" || block === undefined
      ? splitProse(ir.markdown, unit, size)
      : splitOversizedBlock(ir.markdown, block, size);
  const chunks: SectionChunk[] = [];
  for (const piece of pieces) {
    chunks.push({ ...piece, sectionId });
  }
  return chunks;
}

/** Adds the chunk being built, if there is one. */
function addChunk(chunks: SectionChunk[], chunk: SectionChunk | undefined): void {
  if (chunk !== undefined) {
    chunks.push(chunk);
  }
}
