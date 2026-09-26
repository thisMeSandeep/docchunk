// Types every strategy implements, so the registry can look strategies up by name.
import type { DocumentIR } from "../ir/ir-types";
import type { StrategyName, StrategyOptionsByName } from "../types";

/** A strategy's options after defaults are applied: every option has a value. */
export type ResolvedStrategyOptions = {
  [Name in StrategyName]: Required<StrategyOptionsByName[Name]>;
};

/** A chunk as a strategy returns it: only a range. finalize-chunks turns it into a Chunk. */
export interface RawChunk {
  /** Start offset in the normalized Markdown. */
  start: number;
  /** End offset in the normalized Markdown (exclusive). */
  end: number;
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
