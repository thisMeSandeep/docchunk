// Cuts the document's blocks down to one range, so a chunk can be re-chunked inside itself (hierarchical).
import type { Block, Range } from "../ir/ir-types";

/** Returns the blocks that overlap the range, each cut to fit inside it. Table headers and code fences keep their positions. */
export function clipBlocks(blocks: Block[], range: Range): Block[] {
  const clipped: Block[] = [];
  let blockIndex = firstBlockEndingAfter(blocks, range.start);
  while (blockIndex < blocks.length) {
    const block = blocks[blockIndex];
    if (block === undefined || block.start >= range.end) {
      break;
    }
    clipped.push(clipBlock(block, range));
    blockIndex++;
  }
  return clipped;
}

/** Returns the block cut to the range. A header or fence left outside tells the splitters to add it as a prefix or suffix. */
function clipBlock(block: Block, range: Range): Block {
  const isInside = block.start >= range.start && block.end <= range.end;
  if (isInside) {
    return block;
  }
  const clipped: Block = {
    ...block,
    start: Math.max(block.start, range.start),
    end: Math.min(block.end, range.end),
  };
  if (block.parts !== undefined) {
    clipped.parts = clipRanges(block.parts, range);
  }
  return clipped;
}

/** Returns the ranges that overlap the range, each cut to fit inside it. */
function clipRanges(ranges: Range[], range: Range): Range[] {
  const clipped: Range[] = [];
  for (const part of ranges) {
    const start = Math.max(part.start, range.start);
    const end = Math.min(part.end, range.end);
    if (start < end) {
      clipped.push({ start, end });
    }
  }
  return clipped;
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
