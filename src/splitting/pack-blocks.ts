// Packs whole blocks into chunks of at most `size`, never across a section. Shared by structure, paragraph, and heading.
import type { Block } from "../ir/ir-types";
import { measure } from "../output/measure";
import type { SectionChunk } from "../strategies/strategy-types";
import { splitOversizedBlock } from "./split-oversized-block";

/** Blocks that stay together: any headings and the block after them in the same section. */
export interface BlockUnit extends SectionChunk {
  blocks: Block[];
}

/** Returns the blocks grouped into units, so a heading is never separated from the block after it. */
export function buildBlockUnits(blocks: Block[]): BlockUnit[] {
  const units: BlockUnit[] = [];
  let pendingHeadings: Block[] = [];
  for (const block of blocks) {
    const firstHeading = pendingHeadings[0];
    // A heading followed by a new section has no content of its own, so it becomes a unit by itself.
    if (firstHeading !== undefined && firstHeading.sectionId !== block.sectionId) {
      units.push(createUnit(pendingHeadings));
      pendingHeadings = [];
    }
    if (block.type === "heading") {
      pendingHeadings.push(block);
      continue;
    }
    units.push(createUnit([...pendingHeadings, block]));
    pendingHeadings = [];
  }
  if (pendingHeadings.length > 0) {
    units.push(createUnit(pendingHeadings));
  }
  return units;
}

/** Packs units into chunks of at most `size`. A new chunk starts at each section, or when the next unit does not fit. */
export function packBlocks(markdown: string, blocks: Block[], size: number): SectionChunk[] {
  const chunks: SectionChunk[] = [];
  let current: SectionChunk | undefined;
  for (const unit of buildBlockUnits(blocks)) {
    if (measure(unit.start, unit.end) > size) {
      addChunk(chunks, current);
      current = undefined;
      chunks.push(...splitUnit(markdown, unit, size));
      continue;
    }
    const canJoinCurrent =
      current !== undefined &&
      current.sectionId === unit.sectionId &&
      measure(current.start, unit.end) <= size;
    if (current !== undefined && canJoinCurrent) {
      current.end = unit.end;
      continue;
    }
    addChunk(chunks, current);
    current = { start: unit.start, end: unit.end, sectionId: unit.sectionId };
  }
  addChunk(chunks, current);
  return chunks;
}

/** Splits a unit larger than `size`: blocks that fit become chunks, larger blocks go through the oversize cascade. */
function splitUnit(markdown: string, unit: BlockUnit, size: number): SectionChunk[] {
  const chunks: SectionChunk[] = [];
  for (const block of unit.blocks) {
    if (measure(block.start, block.end) <= size) {
      chunks.push({ start: block.start, end: block.end, sectionId: block.sectionId });
      continue;
    }
    for (const piece of splitOversizedBlock(markdown, block, size)) {
      chunks.push({ ...piece, sectionId: block.sectionId });
    }
  }
  return chunks;
}

/** Builds a unit from consecutive blocks. The first block's section is the unit's section. */
function createUnit(blocks: Block[]): BlockUnit {
  const firstBlock = blocks[0];
  const lastBlock = blocks.at(-1);
  return {
    start: firstBlock?.start ?? 0,
    end: lastBlock?.end ?? 0,
    sectionId: firstBlock?.sectionId ?? 0,
    blocks,
  };
}

/** Adds the chunk being built, if there is one. */
function addChunk(chunks: SectionChunk[], chunk: SectionChunk | undefined): void {
  if (chunk !== undefined) {
    chunks.push(chunk);
  }
}
