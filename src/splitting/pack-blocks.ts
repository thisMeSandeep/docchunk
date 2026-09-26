// Packs whole blocks into chunks of at most `size`, never across a section. Shared by structure, paragraph, and heading.
import type { Block, Range } from "../ir/ir-types";
import { measureRawChunk } from "../output/measure";
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
    if (measureRawChunk(unit) > size) {
      addChunk(chunks, current);
      current = undefined;
      chunks.push(...splitUnit(markdown, unit, size));
      continue;
    }
    if (current !== undefined && canJoin(current, unit, size)) {
      current.end = unit.end;
      if (unit.suffix !== undefined) {
        current.suffix = unit.suffix;
      }
      continue;
    }
    addChunk(chunks, current);
    current = sectionChunkOf(unit);
  }
  addChunk(chunks, current);
  return chunks;
}

/** Returns true when the unit can be added to the current chunk: same section, still within size, and no fence in between. */
function canJoin(current: SectionChunk, unit: BlockUnit, size: number): boolean {
  if (
    current.sectionId !== unit.sectionId ||
    current.suffix !== undefined ||
    unit.prefix !== undefined
  ) {
    return false;
  }
  const joined = { ...current, end: unit.end, suffix: unit.suffix };
  return measureRawChunk(joined) <= size;
}

/** Splits a unit larger than `size`: blocks that fit become chunks, larger blocks go through the oversize cascade. */
function splitUnit(markdown: string, unit: BlockUnit, size: number): SectionChunk[] {
  const chunks: SectionChunk[] = [];
  for (const block of unit.blocks) {
    const blockChunk = sectionChunkOf(createUnit([block]));
    if (measureRawChunk(blockChunk) <= size) {
      chunks.push(blockChunk);
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
  const unit: BlockUnit = {
    start: firstBlock?.start ?? 0,
    end: lastBlock?.end ?? 0,
    sectionId: firstBlock?.sectionId ?? 0,
    blocks,
  };
  const prefix = firstBlock === undefined ? undefined : missingPrefix(firstBlock);
  const suffix = lastBlock === undefined ? undefined : missingSuffix(lastBlock);
  if (prefix !== undefined) {
    unit.prefix = prefix;
  }
  if (suffix !== undefined) {
    unit.suffix = suffix;
  }
  return unit;
}

/** Returns a table header or opening fence that lies before a block cut short at its start (hierarchical children). */
function missingPrefix(block: Block): Range | undefined {
  const opener = block.type === "table" ? block.headerPart : block.openingFence;
  if (opener !== undefined && opener.start < block.start) {
    return opener;
  }
  return undefined;
}

/** Returns a closing fence that lies after a code block cut short at its end (hierarchical children). */
function missingSuffix(block: Block): Range | undefined {
  const closer = block.closingFence;
  if (closer !== undefined && closer.end > block.end) {
    return closer;
  }
  return undefined;
}

/** Returns the unit as a chunk, keeping its prefix and suffix but not its list of blocks. */
function sectionChunkOf(unit: BlockUnit): SectionChunk {
  const chunk: SectionChunk = { start: unit.start, end: unit.end, sectionId: unit.sectionId };
  if (unit.prefix !== undefined) {
    chunk.prefix = unit.prefix;
  }
  if (unit.suffix !== undefined) {
    chunk.suffix = unit.suffix;
  }
  return chunk;
}

/** Adds the chunk being built, if there is one. */
function addChunk(chunks: SectionChunk[], chunk: SectionChunk | undefined): void {
  if (chunk !== undefined) {
    chunks.push(chunk);
  }
}
