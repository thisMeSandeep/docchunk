// Turns the ranges a strategy returns into finished chunks: text, ids, hashes, index, headings, and metadata.
import type { Block, DocumentIR, Range } from "../ir/ir-types";
import { canonicalOptions } from "../options/canonical-options";
import type { ResolvedOptions } from "../options/resolve-options";
import type { RawChunk } from "../strategies/strategy-types";
import type { Chunk } from "../types";
import { hashText } from "./hash";

/** Returns the finished chunks, sorted by position. Drops ranges that are empty after trimming. */
export function finalizeChunks(
  ir: DocumentIR,
  rawChunks: RawChunk[],
  options: ResolvedOptions,
  documentId: string,
): Chunk[] {
  const keptRanges: Range[] = [];
  for (const rawChunk of rawChunks) {
    const trimmedRange = trimRange(ir.markdown, rawChunk);
    if (trimmedRange !== undefined && !isOnlyThematicBreaks(ir.blocks, trimmedRange)) {
      keptRanges.push(trimmedRange);
    }
  }
  keptRanges.sort(compareRanges);

  const idPrefix = `${documentId}\n${canonicalOptions(options)}`;
  const chunks: Chunk[] = [];
  for (const [index, range] of keptRanges.entries()) {
    chunks.push(buildChunk(ir, range, index, idPrefix, options.metadata));
  }
  return chunks;
}

/** Builds one chunk from its trimmed range. */
function buildChunk(
  ir: DocumentIR,
  range: Range,
  index: number,
  idPrefix: string,
  metadata: Record<string, unknown>,
): Chunk {
  const text = ir.markdown.slice(range.start, range.end);
  const touchedBlocks = findTouchedBlocks(ir.blocks, range);
  const firstBlock = touchedBlocks[0];
  return {
    id: hashText(`${idPrefix}\n${range.start}\n${range.end}`),
    text,
    index,
    start: range.start,
    end: range.end,
    charCount: text.length,
    headingPath: firstBlock === undefined ? [] : [...firstBlock.headingPath],
    blockTypes: uniqueBlockTypes(touchedBlocks),
    contentHash: hashText(text),
    // Each chunk gets its own copy, so changing one chunk's metadata does not change the others.
    metadata: { ...metadata },
  };
}

/** Returns the range without leading and trailing whitespace, or undefined if nothing is left. */
function trimRange(markdown: string, range: Range): Range | undefined {
  let start = range.start;
  let end = range.end;
  while (start < end && isWhitespace(markdown, start)) {
    start++;
  }
  while (end > start && isWhitespace(markdown, end - 1)) {
    end--;
  }
  if (start === end) {
    return undefined;
  }
  return { start, end };
}

/** Returns true when the character at the index is whitespace. */
function isWhitespace(markdown: string, index: number): boolean {
  return /\s/.test(markdown.charAt(index));
}

/** Returns true when every block the range touches is a thematic break (---). */
function isOnlyThematicBreaks(blocks: Block[], range: Range): boolean {
  const touchedBlocks = findTouchedBlocks(blocks, range);
  if (touchedBlocks.length === 0) {
    return false;
  }
  for (const block of touchedBlocks) {
    if (block.type !== "thematicBreak") {
      return false;
    }
  }
  return true;
}

/** Returns the blocks that overlap the range, in document order. */
function findTouchedBlocks(blocks: Block[], range: Range): Block[] {
  const touchedBlocks: Block[] = [];
  let blockIndex = firstBlockEndingAfter(blocks, range.start);
  while (blockIndex < blocks.length) {
    const block = blocks[blockIndex];
    if (block === undefined || block.start >= range.end) {
      break;
    }
    touchedBlocks.push(block);
    blockIndex++;
  }
  return touchedBlocks;
}

/** Returns the index of the first block that ends after the offset, found by binary search. */
function firstBlockEndingAfter(blocks: Block[], offset: number): number {
  let low = 0;
  let high = blocks.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const middleBlock = blocks[middle];
    if (middleBlock !== undefined && middleBlock.end <= offset) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

/** Returns the block types in order, each listed once. */
function uniqueBlockTypes(blocks: Block[]): string[] {
  const types: string[] = [];
  for (const block of blocks) {
    if (!types.includes(block.type)) {
      types.push(block.type);
    }
  }
  return types;
}

/** Orders ranges by start, then by end. */
function compareRanges(first: Range, second: Range): number {
  if (first.start !== second.start) {
    return first.start - second.start;
  }
  return first.end - second.end;
}
