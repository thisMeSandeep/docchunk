// Public types: document sources, formats, options, and chunking results.
import type { DocchunkError } from "./errors";

/** A document format docchunk can read. */
export type DocumentFormat =
  | "pdf"
  | "docx"
  | "doc"
  | "pptx"
  | "ppt"
  | "xlsx"
  | "xls"
  | "odt"
  | "ods"
  | "odp"
  | "rtf"
  | "epub"
  | "csv"
  | "markdown"
  | "text";

/** A document on disk. The format comes from the extension, or from the content. */
export interface PathSource {
  /** Path to the file. */
  path: string;
}

/** A document already loaded into memory as bytes. */
export interface BytesSource {
  /** The file's bytes. */
  bytes: Uint8Array;
  /** Original file name, used to detect the format from its extension. */
  filename?: string;
  /** The format, when known. Skips detection. */
  format?: DocumentFormat;
}

/** Markdown or plain text already in memory as a string. */
export interface ContentSource {
  /** The document text. */
  content: string;
  /** Whether `content` is Markdown or plain text. */
  format: "markdown" | "text";
}

/** Where a document comes from: a file path, bytes, or a string. */
export type DocumentSource = PathSource | BytesSource | ContentSource;

/** Options for each strategy, keyed by strategy name. */
export interface StrategyOptionsByName {
  /** The default. Packs whole blocks into chunks up to `size`, never across a section. Keeps tables, code, and lists whole when they fit. */
  structure: {
    /** Maximum characters per chunk. Default 1500. */
    size?: number;
    /** Chunks smaller than this are merged into a neighbor in the same section when the result fits `size`. Default 200. */
    minSize?: number;
    /** Characters of whole sentences each chunk repeats from the end of the previous chunk in its section. Must be less than `size`. Default 0. */
    overlapChars?: number;
    /** Headings at this level or higher (1 to 6) start a new section. Default 3. */
    headingLevel?: number;
  };
  /** One chunk per sentence; tables and code blocks count as one sentence. With `size`, packs consecutive sentences. */
  sentence: {
    /** Maximum characters per chunk. Default: no limit, one sentence per chunk. */
    size?: number;
    /** Chunks smaller than this are merged into a neighbor in the same section when the result fits `size`. Default 1 (no merging). */
    minSize?: number;
    /** Characters of whole sentences each chunk repeats from the end of the previous chunk in its section. Default 0. */
    overlapChars?: number;
  };
  /** One chunk per block, with a heading kept with the block after it. With `size`, packs consecutive blocks. */
  paragraph: {
    /** Maximum characters per chunk. Default: no limit, one block per chunk. */
    size?: number;
    /** Chunks smaller than this are merged into a neighbor in the same section when the result fits `size`. Default 1 (no merging). */
    minSize?: number;
    /** Characters of whole sentences each chunk repeats from the end of the previous chunk in its section. Default 0. */
    overlapChars?: number;
  };
  /** One chunk per section, split at headings up to `headingLevel`. With `size`, larger sections are split. */
  heading: {
    /** Maximum characters per chunk. Default: no limit, one section per chunk. */
    size?: number;
    /** Headings at this level or higher (1 to 6) start a new section. Default 3. */
    headingLevel?: number;
  };
  /** One chunk per sentence unit, with `contextText` holding the sentences around it in the same section. */
  "sentence-window": {
    /** Sentence units on each side of the chunk's sentence that go into its contextText. Default 3. */
    windowSize?: number;
  };
  /** Two levels: large parent chunks, each split into small child chunks. Embed children, send parents to the model. */
  "parent-child": {
    /** Maximum characters per parent chunk. Must be larger than `childSize`. Default 4000. */
    parentSize?: number;
    /** Maximum characters per child chunk. Default 800. */
    childSize?: number;
  };
  /** Nested chunks at several sizes, or following the heading tree, linked by parentId and childIds. */
  hierarchical: {
    /** "size": one level per entry in `levels`; "heading": one level per heading depth. Default "size". */
    by?: "size" | "heading";
    /** Maximum characters per chunk at each level, largest first, each smaller than the one before. Used with by "size". Default [6000, 1500, 400]. */
    levels?: number[];
    /** Headings at this level or higher (1 to 6) start a new section. Default 3. */
    headingLevel?: number;
    /** Maximum characters per chunk when a section without subsections is split. Used with by "heading". Default 1500. */
    leafSize?: number;
  };
  /** Cuts the Markdown every `size` characters, ignoring structure. */
  fixed: {
    /** Maximum characters per chunk. Default 1500. */
    size?: number;
    /** "word" moves a cut back to whitespace within the last 10% of the chunk; "char" cuts at exactly `size`. Default "word". */
    boundary?: "word" | "char";
  };
  /** Like fixed, but consecutive chunks share `overlapChars` characters. */
  "fixed-overlap": {
    /** Maximum characters per chunk, including the overlap. Default 1500. */
    size?: number;
    /** Characters each chunk repeats from the end of the previous one. Must be less than `size`. Default 200. */
    overlapChars?: number;
    /** "word" moves a cut back to whitespace within the last 10% of the chunk; "char" cuts at exactly `size`. Default "word". */
    boundary?: "word" | "char";
  };
  /** Splits on separators (headings, blank lines, lines), then sentences, then spaces, until pieces fit `size`. */
  recursive: {
    /** Maximum characters per chunk. Default 1500. */
    size?: number;
    /** Characters of whole pieces each chunk repeats from the end of the previous one. Must be less than `size`. Default 0. */
    overlapChars?: number;
    /** Separators tried in order before sentences, spaces, and a hard cut. Default ["\n# ", "\n## ", "\n### ", "\n#### ", "\n\n", "\n"]. */
    separators?: string[];
  };
  /** A window of `size` characters that moves forward `step` characters at a time. */
  "sliding-window": {
    /** Characters in each window. Default 1500. */
    size?: number;
    /** Characters the window moves forward each time. At most `size`. Default 750. */
    step?: number;
    /** "word" moves a cut back to whitespace within the last 10% of the chunk; "char" cuts at exactly `size`. Default "word". */
    boundary?: "word" | "char";
  };
}

/** Name of a chunking strategy. */
export type StrategyName = keyof StrategyOptionsByName;

/** Options shared by every strategy. */
export interface CommonOptions {
  /** Copied onto every chunk's `metadata`. Does not change chunk ids. Default {}. */
  metadata?: Record<string, unknown>;
  /** Id for the document, used instead of a hash of its Markdown. Changes every chunk id. */
  documentId?: string;
  /** Prepends the heading path ("A > B > C" and a blank line) to each chunk's text. Counts toward `size`. Default false. */
  headingPrefix?: boolean;
  /** Stops chunking with an ABORTED error when the signal is aborted. */
  signal?: AbortSignal;
}

/** Options for one strategy: its name plus only the options that strategy accepts. */
type OptionsForStrategy = {
  [Name in StrategyName]: { strategy: Name } & StrategyOptionsByName[Name];
}[StrategyName];

/** Options when no strategy is named: the default strategy, structure, with its options. */
type DefaultStrategyOptions = { strategy?: undefined } & StrategyOptionsByName["structure"];

/** Options for chunkDocument: the strategy and its options, plus the options every strategy shares. */
export type ChunkOptions = CommonOptions & (DefaultStrategyOptions | OptionsForStrategy);

/** One chunk of a document. */
export interface Chunk {
  /** Stable id: the same document, options, and range always give the same id. */
  id: string;
  /** The chunk text. */
  text: string;
  /** Surrounding sentences, for the sentence-window strategy only. */
  contextText?: string;
  /** Position in the chunk list, starting at 0. Sorted by start offset, then level. */
  index: number;
  /** Start offset in characters within `document.markdown`. */
  start: number;
  /** End offset in characters within `document.markdown` (exclusive). */
  end: number;
  /** Length of `text` in characters. */
  charCount: number;
  /** Headings above the start of this chunk, outermost first, as plain text. */
  headingPath: string[];
  /** Block types this chunk touches, in order, without duplicates. */
  blockTypes: string[];
  /** Id of the chunk that contains this one (parent-child and hierarchical only). */
  parentId?: string;
  /** Ids of the chunks this one contains (parent-child and hierarchical only). */
  childIds?: string[];
  /** Nesting level, 0 for the largest chunks (parent-child and hierarchical only). */
  level?: number;
  /** Hash of `text`, to detect changed chunks. */
  contentHash: string;
  /** The `metadata` option, copied onto every chunk. */
  metadata: Record<string, unknown>;
}

/** Information about the chunked document. */
export interface DocumentInfo {
  /** The `documentId` option, or a hash of the normalized Markdown. */
  id: string;
  /** The normalized Markdown that chunk offsets refer to. */
  markdown: string;
  /** Format of the original document. */
  sourceFormat: DocumentFormat;
  /** Path of the original file, when the source was a path. */
  sourcePath?: string;
  /** Length of `markdown` in characters. */
  charCount: number;
}

/** Summary numbers about the chunks. */
export interface ChunkStats {
  /** Number of chunks. */
  count: number;
  /** Characters in the smallest chunk. */
  minChars: number;
  /** Characters in the largest chunk. */
  maxChars: number;
  /** Average characters per chunk, rounded to a whole number. */
  avgChars: number;
  /** Time taken, in milliseconds. */
  durationMs: number;
}

/** Why a warning was raised. */
export type ChunkWarningCode =
  | "NO_TEXT_LAYER"
  | "EMPTY_DOCUMENT"
  | "LARGE_CHUNK"
  | "OVERSIZED_BLOCK";

/** A problem that did not stop chunking. */
export interface ChunkWarning {
  /** Why the warning was raised. */
  code: ChunkWarningCode;
  /** Human-readable explanation. */
  message: string;
  /** Index of the chunk the warning is about, if any. */
  chunkIndex?: number;
}

/** The result of chunking one document. */
export interface ChunkResult {
  /** The chunks, in order. */
  chunks: Chunk[];
  /** Information about the document. */
  document: DocumentInfo;
  /** Summary numbers about the chunks. */
  stats: ChunkStats;
  /** Problems that did not stop chunking. */
  warnings: ChunkWarning[];
}

/** The result for one document in a batch: its chunks, or the error it failed with. */
export type BatchItem =
  | { ok: true; result: ChunkResult }
  | { ok: false; error: DocchunkError; sourceIndex: number };

/** A chunk with its child chunks, as built by `buildChunkTree`. */
export interface ChunkTreeNode {
  /** The chunk. */
  chunk: Chunk;
  /** Nodes for the chunks this one contains. */
  children: ChunkTreeNode[];
}
