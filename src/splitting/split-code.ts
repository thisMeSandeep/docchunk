// Splits a code block that is larger than `size` into pieces of whole lines, each wrapped in the original fence (PRD 6.3).
import type { Block, Range } from "../ir/ir-types";
import { measure } from "../output/measure";
import type { RawChunk } from "../strategies/strategy-types";
import { groupParts, groupsToRawChunks, oversizedPieces } from "./group-parts";

/** The opening and closing fence lines of a code block, if it has them. */
interface Fences {
  opening: Range | undefined;
  closing: Range | undefined;
}

/** Returns pieces of at most `size` characters. Fence lines are repeated on every piece and count toward size. */
export function splitCode(markdown: string, code: Block, size: number): RawChunk[] {
  const lines = code.parts ?? [];
  if (lines.length === 0) {
    return groupsToRawChunks(markdown, groupParts([code], size), size);
  }
  const fences: Fences = { opening: code.openingFence, closing: code.closingFence };
  const lineBudget = size - costWithNewline(fences.opening) - costWithNewline(fences.closing);
  if (lineBudget < 1) {
    return splitWithoutRepeatingFences(markdown, code, lines, size);
  }
  const firstLineStart = lines[0]?.start;
  const lastLineEnd = lines.at(-1)?.end;
  const pieces: RawChunk[] = [];
  for (const group of groupParts(lines, lineBudget)) {
    // A fence is "in place" when the first or last group can take it from the block's own range,
    // instead of repeating it as a prefix or suffix.
    const isOpeningInPlace =
      group.start === firstLineStart && isFenceInsideBlock(code, fences.opening);
    const isClosingInPlace = group.end === lastLineEnd && isFenceInsideBlock(code, fences.closing);
    if (group.isOversized) {
      // A line too large for `size` cannot carry the fences, so a fence next to it becomes its own piece.
      if (isOpeningInPlace && fences.opening !== undefined) {
        pieces.push({ start: fences.opening.start, end: fences.opening.end });
      }
      pieces.push(...oversizedPieces(markdown, group, size));
      if (isClosingInPlace && fences.closing !== undefined) {
        pieces.push({ start: fences.closing.start, end: fences.closing.end });
      }
      continue;
    }
    pieces.push(fencedPiece(code, group, isOpeningInPlace, isClosingInPlace, fences));
  }
  return pieces;
}

/** Returns true when there is no fence, or the fence lies inside the block's range (it was not cut away). */
function isFenceInsideBlock(code: Block, fence: Range | undefined): boolean {
  if (fence === undefined) {
    return true;
  }
  return fence.start >= code.start && fence.end <= code.end;
}

/** Returns a piece of lines wrapped in the fences. A fence in place is taken from the block itself. */
function fencedPiece(
  code: Block,
  group: Range,
  isOpeningInPlace: boolean,
  isClosingInPlace: boolean,
  fences: Fences,
): RawChunk {
  const piece: RawChunk = {
    start: isOpeningInPlace ? code.start : group.start,
    end: isClosingInPlace ? code.end : group.end,
  };
  if (!isOpeningInPlace && fences.opening !== undefined) {
    piece.prefix = fences.opening;
  }
  if (!isClosingInPlace && fences.closing !== undefined) {
    piece.suffix = fences.closing;
  }
  return piece;
}

/** Splits the lines as they are when the fences alone fill `size`. Fences inside the block's range are included. */
function splitWithoutRepeatingFences(
  markdown: string,
  code: Block,
  lines: Range[],
  size: number,
): RawChunk[] {
  const allLines: Range[] = [];
  if (code.openingFence !== undefined && code.openingFence.start >= code.start) {
    allLines.push(code.openingFence);
  }
  allLines.push(...lines);
  if (code.closingFence !== undefined && code.closingFence.end <= code.end) {
    allLines.push(code.closingFence);
  }
  return groupsToRawChunks(markdown, groupParts(allLines, size), size);
}

/** Returns the size a fence line adds to a piece: its length plus the newline that joins it. */
function costWithNewline(fence: Range | undefined): number {
  if (fence === undefined) {
    return 0;
  }
  return measure(fence.start, fence.end) + 1;
}
