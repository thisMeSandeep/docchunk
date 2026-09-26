// Adds overlap to chunks: whole sentence units repeated from the end of the previous chunk in the same section (PRD 6.2).
import type { Unit } from "../ir/ir-types";
import { measure, measureRawChunk } from "../output/measure";
import type { SectionChunk } from "../strategies/strategy-types";

/** Returns the chunks with each one's start moved back over whole units of the previous chunk, up to `overlapChars`. */
export function addOverlap(
  chunks: SectionChunk[],
  units: Unit[],
  overlapChars: number,
  size: number,
): SectionChunk[] {
  if (overlapChars === 0) {
    return chunks;
  }
  const result: SectionChunk[] = [];
  for (const [index, chunk] of chunks.entries()) {
    const previous = chunks[index - 1];
    // A chunk with a prefix starts with a repeated header or fence, so nothing can go before it.
    const canOverlap =
      previous !== undefined &&
      previous.sectionId === chunk.sectionId &&
      chunk.prefix === undefined;
    if (!canOverlap) {
      result.push(chunk);
      continue;
    }
    const overlapStart = findOverlapStart(chunk, previous, units, overlapChars, size);
    result.push({ ...chunk, start: overlapStart });
  }
  return result;
}

/** Returns the earliest start of whole units at the end of `previous` that fit in the overlap and in `size`. */
function findOverlapStart(
  chunk: SectionChunk,
  previous: SectionChunk,
  units: Unit[],
  overlapChars: number,
  size: number,
): number {
  let overlapStart = chunk.start;
  let unitIndex = lastUnitEndingBy(units, previous.end);
  while (unitIndex >= 0) {
    const unit = units[unitIndex];
    if (unit === undefined || unit.start < previous.start) {
      break;
    }
    const overlapFits = measure(unit.start, previous.end) <= overlapChars;
    const chunkFits = measureRawChunk({ ...chunk, start: unit.start }) <= size;
    if (!overlapFits || !chunkFits) {
      break;
    }
    overlapStart = unit.start;
    unitIndex--;
  }
  return overlapStart;
}

/** Returns the index of the last unit that ends at or before the offset, found by binary search, or -1. */
function lastUnitEndingBy(units: Unit[], offset: number): number {
  let low = 0;
  let high = units.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const middleUnit = units[middle];
    if (middleUnit !== undefined && middleUnit.end <= offset) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low - 1;
}
