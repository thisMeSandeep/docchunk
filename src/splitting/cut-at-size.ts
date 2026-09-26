// Cuts a range of text into pieces of at most `size` characters, ignoring Markdown structure.
import type { Range } from "../ir/ir-types";

/** Where a cut may fall: at a word boundary when possible, or at exactly `size`. */
export type CutBoundary = "word" | "char";

/** Share of the piece, at its end, searched for whitespace when cutting at a word boundary. */
const wordSearchShare = 0.1;

/** Returns pieces covering the range, each at most `size` characters. Consecutive pieces share `overlapChars`. */
export function cutAtSize(
  text: string,
  range: Range,
  size: number,
  boundary: CutBoundary,
  overlapChars = 0,
): Range[] {
  const pieces: Range[] = [];
  let pieceStart = range.start;
  while (pieceStart < range.end) {
    const pieceEnd = findCut(text, pieceStart, range.end, size, boundary);
    pieces.push({ start: pieceStart, end: pieceEnd });
    if (pieceEnd === range.end) {
      break;
    }
    pieceStart = nextPieceStart(text, pieceStart, pieceEnd, overlapChars);
  }
  return pieces;
}

/** Returns where the next piece starts: `overlapChars` before this piece ends, but always after this piece starts. */
function nextPieceStart(
  text: string,
  pieceStart: number,
  pieceEnd: number,
  overlapChars: number,
): number {
  let nextStart = pieceEnd - overlapChars;
  // A word-boundary cut can make a piece shorter than the overlap; the next piece must still move forward.
  if (nextStart <= pieceStart) {
    nextStart = pieceStart + 1;
  }
  if (isInsideSurrogatePair(text, nextStart)) {
    // Start before the emoji so it stays whole, unless that would not move forward.
    nextStart = nextStart - 1 > pieceStart ? nextStart - 1 : nextStart + 1;
  }
  return nextStart;
}

/** Returns where the piece starting at `pieceStart` should end. */
function findCut(
  text: string,
  pieceStart: number,
  rangeEnd: number,
  size: number,
  boundary: CutBoundary,
): number {
  const maxEnd = pieceStart + size;
  if (maxEnd >= rangeEnd) {
    return rangeEnd;
  }
  let cut = maxEnd;
  if (boundary === "word" && isInsideWord(text, cut)) {
    cut = lastWhitespaceCut(text, maxEnd, size) ?? maxEnd;
  }
  if (isInsideSurrogatePair(text, cut)) {
    cut = cut - 1;
  }
  // With size 1, a surrogate pair cannot fit, so the piece keeps the whole pair.
  if (cut === pieceStart) {
    cut = maxEnd + 1;
  }
  return cut;
}

/** Returns the cut just after the last whitespace in the final 10% of the piece, or undefined if there is none. */
function lastWhitespaceCut(text: string, maxEnd: number, size: number): number | undefined {
  const searchLength = Math.max(1, Math.ceil(size * wordSearchShare));
  const searchStart = maxEnd - searchLength;
  for (let index = maxEnd - 1; index >= searchStart; index--) {
    if (isWhitespace(text, index)) {
      return index + 1;
    }
  }
  return undefined;
}

/** Returns true when the characters on both sides of the offset are not whitespace. */
function isInsideWord(text: string, offset: number): boolean {
  return !isWhitespace(text, offset - 1) && !isWhitespace(text, offset);
}

/** Returns true when the character at the index is whitespace. */
function isWhitespace(text: string, index: number): boolean {
  return /\s/.test(text.charAt(index));
}

/** Returns true when the offset falls between the two halves of a surrogate pair, such as an emoji. */
function isInsideSurrogatePair(text: string, offset: number): boolean {
  const before = text.charCodeAt(offset - 1);
  const after = text.charCodeAt(offset);
  const isHighSurrogate = before >= 0xd800 && before <= 0xdbff;
  const isLowSurrogate = after >= 0xdc00 && after <= 0xdfff;
  return isHighSurrogate && isLowSurrogate;
}
