// Types for the intermediate representation (IR): the parsed document that every strategy reads.

/** Kind of top-level Markdown block. */
export type BlockType =
  | "heading"
  | "paragraph"
  | "list"
  | "table"
  | "code"
  | "blockquote"
  | "thematicBreak"
  | "html"
  | "other";

/** A span of the normalized Markdown, from `start` up to (not including) `end`. */
export interface Range {
  start: number;
  end: number;
}

/** One top-level block of the document. */
export interface Block {
  type: BlockType;
  /** Start offset in the normalized Markdown. */
  start: number;
  /** End offset in the normalized Markdown (exclusive). */
  end: number;
  /** Heading level from 1 to 6, for headings only. */
  level?: number;
  /** Headings above this block, outermost first, as plain text. */
  headingPath: string[];
  /** Section number; it changes at every heading with level <= headingLevel. */
  sectionId: number;
  /** Item ranges for lists, row ranges for tables, line ranges for code. */
  parts?: Range[];
  /** Header row plus delimiter row, for tables only. */
  headerPart?: Range;
}

/** A piece of text that sentence-based strategies treat as one unit. */
export interface Unit {
  start: number;
  end: number;
  /** Index of the block this unit belongs to. */
  blockIndex: number;
  /** A sentence of prose, or a whole table or code block. */
  kind: "sentence" | "table" | "code";
}

/** The parsed document. Built once and shared by every strategy. */
export interface DocumentIR {
  /** The normalized Markdown that all offsets refer to. */
  markdown: string;
  /** Top-level blocks in document order. */
  blocks: Block[];
  /** Sentence units, filled in the first time they are needed. */
  sentenceUnits?: Unit[];
}
