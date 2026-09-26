// Warnings about single chunks: OVERSIZED_BLOCK for hard cuts, LARGE_CHUNK for large chunks with no size limit.
import { noSizeLimit } from "../options/option-checks";
import type { ResolvedOptions } from "../options/resolve-options";
import type { RawChunk } from "../strategies/strategy-types";
import type { Chunk, ChunkWarning } from "../types";

/** Chunks larger than this get a LARGE_CHUNK warning when the strategy has no size limit (PRD 6.4). */
const largeChunkChars = 8000;

/** Returns the warnings for one chunk: OVERSIZED_BLOCK for a hard cut, LARGE_CHUNK for a large chunk with no size limit. */
export function chunkWarnings(
  chunk: Chunk,
  rawChunk: RawChunk,
  isSizeLimited: boolean,
): ChunkWarning[] {
  const warnings: ChunkWarning[] = [];
  if (rawChunk.isOversized === true) {
    warnings.push({
      code: "OVERSIZED_BLOCK",
      message: `Chunk ${chunk.index} is a hard cut of a row, item, line, or word longer than size.`,
      chunkIndex: chunk.index,
    });
  }
  if (!isSizeLimited && chunk.charCount > largeChunkChars) {
    warnings.push({
      code: "LARGE_CHUNK",
      message: `Chunk ${chunk.index} has ${chunk.charCount} characters, more than ${largeChunkChars}. Set "size" to split it.`,
      chunkIndex: chunk.index,
    });
  }
  return warnings;
}

/** Returns true when the strategy has a size limit, so LARGE_CHUNK warnings do not apply. */
export function hasSizeLimit(options: ResolvedOptions): boolean {
  const strategyOptions = options.strategyOptions;
  if ("size" in strategyOptions) {
    return strategyOptions.size !== noSizeLimit;
  }
  // hierarchical by "size" limits every level; by "heading" leaves sections unlimited.
  if ("by" in strategyOptions) {
    return strategyOptions.by === "size";
  }
  return false;
}
