// Types every strategy implements, so the registry can look strategies up by name.
import type { DocumentIR, Range } from "../ir/ir-types";
import type { StrategyName, StrategyOptionsByName } from "../types";

/** A strategy's options after defaults are applied: every option has a value. */
export type ResolvedStrategyOptions = {
  [Name in StrategyName]: Required<StrategyOptionsByName[Name]>;
};

/** A chunk as a strategy returns it: ranges only. finalize-chunks turns it into a Chunk. */
export interface RawChunk {
  /** Start offset in the normalized Markdown. */
  start: number;
  /** End offset in the normalized Markdown (exclusive). */
  end: number;
  /** Text added before the chunk, with a newline between: a repeated table header or opening code fence. */
  prefix?: Range;
  /** Text added after the chunk, with a newline between: a closing code fence. */
  suffix?: Range;
  /** True when the chunk is a hard-cut piece of a row, item, line, or word too large for `size`. */
  isOversized?: boolean;
  /** The surrounding range that becomes the chunk's contextText (sentence-window only). */
  context?: Range;
  /** Nesting level, 0 for the largest chunks (hierarchical only). */
  level?: number;
  /** Position of the parent chunk in the list the strategy returns (hierarchical only). */
  parentIndex?: number;
}

/** A raw chunk that knows its section, so post-processing never joins chunks from different sections. */
export interface SectionChunk extends RawChunk {
  /** The section id of the blocks the chunk was made from. */
  sectionId: number;
}

/** Everything the library needs to know about one strategy. */
export interface StrategyDefinition<Name extends StrategyName> {
  /** The strategy's name, the same as its key in the registry. */
  name: Name;
  /** Values used for options the caller leaves out. */
  defaults: ResolvedStrategyOptions[Name];
  /** Throws a DocchunkError with code INVALID_OPTIONS if the options are not allowed. */
  validate: (options: ResolvedStrategyOptions[Name]) => void;
  /** Returns the ranges of the chunks. Never builds chunk text, ids, or hashes. */
  split: (ir: DocumentIR, options: ResolvedStrategyOptions[Name]) => RawChunk[];
}
