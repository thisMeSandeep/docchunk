// The oversize cascade (PRD 6.3): splits one block that is larger than `size` along its structure.
import type { Block, Range } from "../ir/ir-types";
import { sentenceRanges } from "../ir/sentence-units";
import type { RawChunk } from "../strategies/strategy-types";
import { groupParts, oversizedPieces } from "./group-parts";
import { splitCode } from "./split-code";
import { splitList } from "./split-list";
import { splitTable } from "./split-table";

/** Matches a run of non-whitespace characters: one word. */
const wordPattern = /\S+/g;

/** Returns pieces of at most `size`: tables by rows, lists by items, code by lines, other blocks by sentences. */
export function splitOversizedBlock(markdown: string, block: Block, size: number): RawChunk[] {
  if (block.type === "table") {
    return splitTable(markdown, block, size);
  }
  if (block.type === "list") {
    return splitList(markdown, block, size);
  }
  if (block.type === "code") {
    return splitCode(markdown, block, size);
  }
  return splitProse(markdown, block, size);
}

/** Splits prose by sentences, then a sentence that is too large by words, then a word that is too large by a hard cut. */
export function splitProse(markdown: string, range: Range, size: number): RawChunk[] {
  const pieces: RawChunk[] = [];
  const sentences = sentenceRanges(markdown, range);
  for (const sentenceGroup of groupParts(sentences, size)) {
    if (!sentenceGroup.isOversized) {
      pieces.push({ start: sentenceGroup.start, end: sentenceGroup.end });
      continue;
    }
    const words = wordRanges(markdown, sentenceGroup);
    for (const wordGroup of groupParts(words, size)) {
      if (wordGroup.isOversized) {
        pieces.push(...oversizedPieces(markdown, wordGroup, size));
      } else {
        pieces.push({ start: wordGroup.start, end: wordGroup.end });
      }
    }
  }
  return pieces;
}

/** Returns the words in the range: runs of characters between whitespace. */
function wordRanges(markdown: string, range: Range): Range[] {
  const words: Range[] = [];
  const text = markdown.slice(range.start, range.end);
  for (const match of text.matchAll(wordPattern)) {
    const wordStart = range.start + match.index;
    words.push({ start: wordStart, end: wordStart + match[0].length });
  }
  return words;
}
