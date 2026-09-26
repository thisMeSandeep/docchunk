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
  const pieces: RawChunk[] = [];
  for (const group of groupParts(lines, lineBudget)) {
    // A fence is "in place" when the piece's own range can take it from the block, not as a prefix or suffix.
    const isOpeningInPlace = isAtBlockStart(code, fences.opening, group);
    const isClosingInPlace = isAtBlockEnd(code, fences.closing, group);
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

/** Returns true when the group starts the block: right after an opening fence inside the block, or at the block start. */
function isAtBlockStart(code: Block, opening: Range | undefined, group: Range): boolean {
  if (opening === undefined) {
    return group.start === code.start;
  }
  return opening.start === code.start && group.start === opening.end + 1;
}

/** Returns true when the group ends the block: right before a closing fence inside the block, or at the block end. */
function isAtBlockEnd(code: Block, closing: Range | undefined, group: Range): boolean {
  if (closing === undefined) {
    return group.end === code.end;
  }
  return closing.end === code.end && group.end + 1 === closing.start;
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
