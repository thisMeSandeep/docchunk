// Splits a code block that is larger than `size` into pieces of whole lines, each wrapped in the original fence (PRD 6.3).
import type { Block, Range } from "../ir/ir-types";
import { measure } from "../output/measure";
import type { RawChunk } from "../strategies/strategy-types";
import { groupParts, groupsToRawChunks, oversizedPieces } from "./group-parts";

/** Returns pieces of at most `size` characters. Fence lines are repeated on every piece and count toward size. */
export function splitCode(markdown: string, code: Block, size: number): RawChunk[] {
  const lines = code.parts ?? [];
  const firstLine = lines[0];
  const lastLine = lines.at(-1);
  if (firstLine === undefined || lastLine === undefined) {
    return groupsToRawChunks(markdown, groupParts([code], size), size);
  }
  // Indented code has no fence lines: its first line starts the block and its last line ends it.
  const openingFence =
    firstLine.start > code.start ? { start: code.start, end: firstLine.start - 1 } : undefined;
  const closingFence =
    lastLine.end < code.end ? { start: lastLine.end + 1, end: code.end } : undefined;
  const lineBudget = size - costWithNewline(openingFence) - costWithNewline(closingFence);
  if (lineBudget < 1) {
    // The fences alone fill `size`, so they cannot be repeated. Split the block's lines as they are.
    const allLines = [openingFence, ...lines, closingFence].filter((line) => line !== undefined);
    return groupsToRawChunks(markdown, groupParts(allLines, size), size);
  }
  const pieces: RawChunk[] = [];
  const fences: Fences = { opening: openingFence, closing: closingFence };
  for (const group of groupParts(lines, lineBudget)) {
    const isFirstGroup = group.start === firstLine.start;
    const isLastGroup = group.end === lastLine.end;
    if (group.isOversized) {
      // A line too large for `size` cannot carry the fences, so a fence next to it becomes its own piece.
      if (isFirstGroup && openingFence !== undefined) {
        pieces.push({ start: openingFence.start, end: openingFence.end });
      }
      pieces.push(...oversizedPieces(markdown, group, size));
      if (isLastGroup && closingFence !== undefined) {
        pieces.push({ start: closingFence.start, end: closingFence.end });
      }
      continue;
    }
    pieces.push(fencedPiece(code, group, isFirstGroup, isLastGroup, fences));
  }
  return pieces;
}

/** The opening and closing fence lines of a code block, if it has them. */
interface Fences {
  opening: Range | undefined;
  closing: Range | undefined;
}

/** Returns a piece of lines wrapped in the fences. The first and last pieces take a fence from the block itself. */
function fencedPiece(
  code: Block,
  group: Range,
  isFirstGroup: boolean,
  isLastGroup: boolean,
  fences: Fences,
): RawChunk {
  const piece: RawChunk = {
    start: isFirstGroup ? code.start : group.start,
    end: isLastGroup ? code.end : group.end,
  };
  if (!isFirstGroup && fences.opening !== undefined) {
    piece.prefix = fences.opening;
  }
  if (!isLastGroup && fences.closing !== undefined) {
    piece.suffix = fences.closing;
  }
  return piece;
}

/** Returns the size a fence line adds to a piece: its length plus the newline that joins it. */
function costWithNewline(fence: Range | undefined): number {
  if (fence === undefined) {
    return 0;
  }
  return measure(fence.start, fence.end) + 1;
}
