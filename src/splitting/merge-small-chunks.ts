// Merges chunks smaller than `minSize` into a neighbor in the same section (PRD 6.2, structure).
import { measureRawChunk } from "../output/measure";
import type { SectionChunk } from "../strategies/strategy-types";

/** Returns the chunks with each small chunk merged into its previous neighbor, else its next, when the result fits `size`. */
export function mergeSmallChunks(
  chunks: SectionChunk[],
  minSize: number,
  size: number,
): SectionChunk[] {
  const merged: SectionChunk[] = [];
  // Chunks are copied so that a merge into the next chunk does not change the caller's list.
  const pending = chunks.map((chunk) => ({ ...chunk }));
  for (let index = 0; index < pending.length; index++) {
    const chunk = pending[index];
    if (chunk === undefined) {
      continue;
    }
    if (measureRawChunk(chunk) >= minSize) {
      merged.push(chunk);
      continue;
    }
    const previous = merged.at(-1);
    const joinedWithPrevious = previous === undefined ? undefined : tryJoin(previous, chunk, size);
    if (joinedWithPrevious !== undefined) {
      merged[merged.length - 1] = joinedWithPrevious;
      continue;
    }
    const next = pending[index + 1];
    const joinedWithNext = next === undefined ? undefined : tryJoin(chunk, next, size);
    if (joinedWithNext !== undefined) {
      pending[index + 1] = joinedWithNext;
      continue;
    }
    merged.push(chunk);
  }
  return merged;
}

/** Returns one chunk covering both, or undefined if they are in different sections, cannot be joined, or would exceed `size`. */
function tryJoin(
  first: SectionChunk,
  second: SectionChunk,
  size: number,
): SectionChunk | undefined {
  // A suffix or prefix between the two would end up in the middle of the text, so such chunks stay apart.
  const canJoin =
    first.sectionId === second.sectionId &&
    first.suffix === undefined &&
    second.prefix === undefined;
  if (!canJoin) {
    return undefined;
  }
  const joined: SectionChunk = { start: first.start, end: second.end, sectionId: first.sectionId };
  if (first.prefix !== undefined) {
    joined.prefix = first.prefix;
  }
  if (second.suffix !== undefined) {
    joined.suffix = second.suffix;
  }
  if (first.isOversized === true || second.isOversized === true) {
    joined.isOversized = true;
  }
  if (measureRawChunk(joined) > size) {
    return undefined;
  }
  return joined;
}
