// Splits the document into sentence units, the pieces that sentence-based strategies work with.
import { segmenterLocale } from "../config";
import type { Block, DocumentIR, Range, Unit } from "./ir-types";

// The locale comes from the config, so boundaries are the same on every machine.
const sentenceSegmenter = new Intl.Segmenter(segmenterLocale, { granularity: "sentence" });

/** Matches a list item marker and the spaces after it: "- ", "* ", "+ ", "1. ", or "1) ". */
const listMarkerPattern = /^(?:[-*+]|\d{1,9}[.)])[ \t]+/;

/** Returns the document's sentence units, computing them on the first call and reusing them after. */
export function getSentenceUnits(ir: DocumentIR): Unit[] {
  if (ir.sentenceUnits !== undefined) {
    return ir.sentenceUnits;
  }
  const units: Unit[] = [];
  for (const [blockIndex, block] of ir.blocks.entries()) {
    addBlockUnits(units, ir.markdown, block, blockIndex);
  }
  ir.sentenceUnits = units;
  return units;
}

/** Adds the units of one block: one per table or code block, sentences for prose, none for headings. */
function addBlockUnits(units: Unit[], markdown: string, block: Block, blockIndex: number): void {
  if (block.type === "heading" || block.type === "thematicBreak") {
    return;
  }
  if (block.type === "table" || block.type === "code") {
    units.push({ start: block.start, end: block.end, blockIndex, kind: block.type });
    return;
  }
  if (block.type === "list") {
    // Items are segmented one by one, so an item without a full stop still ends its sentence.
    for (const listItem of block.parts ?? []) {
      addListItemUnits(units, markdown, listItem, blockIndex);
    }
    return;
  }
  addSentenceUnits(units, markdown, block, blockIndex);
}

/** Adds the sentence units of one list item. The item's marker joins its first sentence. */
function addListItemUnits(
  units: Unit[],
  markdown: string,
  listItem: Range,
  blockIndex: number,
): void {
  const itemText = markdown.slice(listItem.start, listItem.end);
  const markerLength = listMarkerPattern.exec(itemText)?.[0].length ?? 0;
  const firstUnitIndex = units.length;
  // The marker is skipped because the segmenter reads "1." as a complete sentence.
  addSentenceUnits(
    units,
    markdown,
    { start: listItem.start + markerLength, end: listItem.end },
    blockIndex,
  );
  const firstUnit = units[firstUnitIndex];
  if (firstUnit !== undefined) {
    firstUnit.start = listItem.start;
  }
}

/** Adds one unit per sentence in the range. */
function addSentenceUnits(units: Unit[], markdown: string, range: Range, blockIndex: number): void {
  for (const sentence of sentenceRanges(markdown, range)) {
    units.push({ start: sentence.start, end: sentence.end, blockIndex, kind: "sentence" });
  }
}

/** Returns the sentences in the range, each with surrounding whitespace trimmed off. */
export function sentenceRanges(markdown: string, range: Range): Range[] {
  const sentences: Range[] = [];
  // A line break inside a paragraph does not end a sentence, but the segmenter treats it as one.
  // Spaces keep the text the same length, so offsets still match the Markdown.
  const text = markdown.slice(range.start, range.end).replaceAll("\n", " ");
  for (const sentence of sentenceSegmenter.segment(text)) {
    const leadingSpace = sentence.segment.length - sentence.segment.trimStart().length;
    const trailingSpace = sentence.segment.length - sentence.segment.trimEnd().length;
    const start = range.start + sentence.index + leadingSpace;
    const end = range.start + sentence.index + sentence.segment.length - trailingSpace;
    if (end > start) {
      sentences.push({ start, end });
    }
  }
  return sentences;
}
