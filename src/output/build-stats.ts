// Computes the summary numbers reported with every chunking result.
import type { Chunk, ChunkStats } from "../types";

/** Returns the chunk count, smallest, largest, and average size in characters, and the time taken. */
export function buildStats(chunks: Chunk[], durationMs: number): ChunkStats {
  if (chunks.length === 0) {
    return { count: 0, minChars: 0, maxChars: 0, avgChars: 0, durationMs };
  }
  let minChars = Number.POSITIVE_INFINITY;
  let maxChars = 0;
  let totalChars = 0;
  for (const chunk of chunks) {
    minChars = Math.min(minChars, chunk.charCount);
    maxChars = Math.max(maxChars, chunk.charCount);
    totalChars += chunk.charCount;
  }
  const avgChars = Math.round(totalChars / chunks.length);
  return { count: chunks.length, minChars, maxChars, avgChars, durationMs };
}
