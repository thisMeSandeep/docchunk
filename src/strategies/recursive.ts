// The recursive strategy: splits on separators, then sentences, then spaces, then a hard cut, until pieces fit.
import { segmenterLocale, strategyDefaults } from "../config";
import type { Range } from "../ir/ir-types";
import {
  checkLessThan,
  checkNonEmptyStrings,
  checkNonNegativeInteger,
  checkPositiveInteger,
} from "../options/option-checks";
import { measure } from "../output/measure";
import { cutAtSize } from "../splitting/cut-at-size";
import type { RawChunk, StrategyDefinition } from "./strategy-types";

// The locale comes from the config, so boundaries are the same on every machine.
const sentenceSegmenter = new Intl.Segmenter(segmenterLocale, { granularity: "sentence" });

/** One way of splitting a range: at a separator string, or at sentence boundaries. */
type SplitLevel = { kind: "separator"; separator: string } | { kind: "sentence" };

/** What every step of the recursion needs to know. */
interface SplitContext {
  markdown: string;
  size: number;
  overlapChars: number;
  levels: SplitLevel[];
}

export const recursiveStrategy: StrategyDefinition<"recursive"> = {
  name: "recursive",
  defaults: strategyDefaults.recursive,
  validate: (options) => {
    checkPositiveInteger("size", options.size);
    checkNonNegativeInteger("overlapChars", options.overlapChars);
    checkLessThan("overlapChars", options.overlapChars, "size", options.size);
    checkNonEmptyStrings("separators", options.separators);
  },
  split: (ir, options) => {
    const context: SplitContext = {
      markdown: ir.markdown,
      size: options.size,
      overlapChars: options.overlapChars,
      levels: buildLevels(options.separators),
    };
    const wholeDocument = { start: 0, end: ir.markdown.length };
    const rawChunks: RawChunk[] = [];
    for (const range of splitRange(context, wholeDocument, 0)) {
      rawChunks.push({ start: range.start, end: range.end });
    }
    return rawChunks;
  },
};

/** Returns the split levels in order: the separators, then sentences, then spaces (PRD 6.2). */
function buildLevels(separators: string[]): SplitLevel[] {
  const levels: SplitLevel[] = [];
  for (const separator of separators) {
    levels.push({ kind: "separator", separator });
  }
  levels.push({ kind: "sentence" });
  levels.push({ kind: "separator", separator: " " });
  return levels;
}

/** Returns ranges of at most `size` covering the range, using the first level that splits it. */
function splitRange(context: SplitContext, range: Range, firstLevel: number): Range[] {
  if (measure(range.start, range.end) <= context.size) {
    return [range];
  }
  for (let levelIndex = firstLevel; levelIndex < context.levels.length; levelIndex++) {
    const level = context.levels[levelIndex];
    const cuts = level === undefined ? [] : findCuts(context.markdown, range, level);
    if (cuts.length > 0) {
      const pieces = piecesBetweenCuts(range, cuts);
      return mergePieces(context, pieces, levelIndex + 1);
    }
  }
  // No level splits the range any further, so it is cut at exactly `size`.
  return cutAtSize(context.markdown, range, context.size, "char");
}

/** Joins neighboring small pieces into ranges of at most `size`, and splits large pieces at deeper levels. */
function mergePieces(context: SplitContext, pieces: Range[], nextLevel: number): Range[] {
  const merged: Range[] = [];
  let current: Range[] = [];
  for (const piece of pieces) {
    if (measure(piece.start, piece.end) > context.size) {
      addSpan(merged, current);
      current = [];
      merged.push(...splitRange(context, piece, nextLevel));
      continue;
    }
    const firstPiece = current[0];
    const wouldBeTooLarge =
      firstPiece !== undefined && measure(firstPiece.start, piece.end) > context.size;
    if (wouldBeTooLarge) {
      addSpan(merged, current);
      current = overlapTail(context, current, piece);
    }
    current.push(piece);
  }
  addSpan(merged, current);
  return merged;
}

/** Returns the last pieces of `current` to repeat at the start of the next range, within overlapChars. */
function overlapTail(context: SplitContext, current: Range[], nextPiece: Range): Range[] {
  const lastPiece = current.at(-1);
  if (context.overlapChars === 0 || lastPiece === undefined) {
    return [];
  }
  for (let startIndex = 0; startIndex < current.length; startIndex++) {
    const tailStart = current[startIndex]?.start ?? lastPiece.end;
    const tailFits = measure(tailStart, lastPiece.end) <= context.overlapChars;
    const nextRangeFits = measure(tailStart, nextPiece.end) <= context.size;
    if (tailFits && nextRangeFits) {
      return current.slice(startIndex);
    }
  }
  return [];
}

/** Adds one range spanning all the pieces, if there are any. */
function addSpan(merged: Range[], pieces: Range[]): void {
  const firstPiece = pieces[0];
  const lastPiece = pieces.at(-1);
  if (firstPiece !== undefined && lastPiece !== undefined) {
    merged.push({ start: firstPiece.start, end: lastPiece.end });
  }
}

/** Returns the offsets inside the range where the level splits it. A separator starts the piece after the cut. */
function findCuts(markdown: string, range: Range, level: SplitLevel): number[] {
  const cuts: number[] = [];
  if (level.kind === "sentence") {
    const text = markdown.slice(range.start, range.end);
    for (const sentence of sentenceSegmenter.segment(text)) {
      if (sentence.index > 0) {
        cuts.push(range.start + sentence.index);
      }
    }
    return cuts;
  }
  let searchFrom = range.start + 1;
  while (searchFrom < range.end) {
    const found = markdown.indexOf(level.separator, searchFrom);
    if (found === -1 || found >= range.end) {
      break;
    }
    cuts.push(found);
    searchFrom = found + level.separator.length;
  }
  return cuts;
}

/** Returns the pieces of the range between consecutive cuts. */
function piecesBetweenCuts(range: Range, cuts: number[]): Range[] {
  const pieces: Range[] = [];
  let pieceStart = range.start;
  for (const cut of cuts) {
    pieces.push({ start: pieceStart, end: cut });
    pieceStart = cut;
  }
  pieces.push({ start: pieceStart, end: range.end });
  return pieces;
}
