// Cuts a range into pieces of at most `size` characters without splitting a grapheme (one character as a reader sees it).
import type { Range } from "../ir/ir-types";
import { measure } from "../output/measure";

// A fixed locale keeps grapheme boundaries the same on every machine.
const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

/** Returns pieces covering the range, each at most `size`. A single grapheme larger than `size` gets its own piece. */
export function hardCut(markdown: string, range: Range, size: number): Range[] {
  const pieces: Range[] = [];
  const text = markdown.slice(range.start, range.end);
  let pieceStart = range.start;
  let pieceEnd = range.start;
  for (const grapheme of graphemeSegmenter.segment(text)) {
    const graphemeEnd = range.start + grapheme.index + grapheme.segment.length;
    const wouldBeTooLarge = measure(pieceStart, graphemeEnd) > size;
    if (wouldBeTooLarge && pieceEnd > pieceStart) {
      pieces.push({ start: pieceStart, end: pieceEnd });
      pieceStart = pieceEnd;
    }
    pieceEnd = graphemeEnd;
  }
  if (pieceEnd > pieceStart) {
    pieces.push({ start: pieceStart, end: pieceEnd });
  }
  return pieces;
}
