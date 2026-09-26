// Measures the size of a range of the Markdown. Every size check in the library goes through here.
import type { RawChunk } from "../strategies/strategy-types";

/** Returns the number of characters between two offsets. */
export function measure(start: number, end: number): number {
  return end - start;
}

/** Returns the size of a raw chunk's final text: its range plus any prefix and suffix, each joined by a newline. */
export function measureRawChunk(rawChunk: RawChunk): number {
  let size = measure(rawChunk.start, rawChunk.end);
  if (rawChunk.prefix !== undefined) {
    size += measure(rawChunk.prefix.start, rawChunk.prefix.end) + 1;
  }
  if (rawChunk.suffix !== undefined) {
    size += measure(rawChunk.suffix.start, rawChunk.suffix.end) + 1;
  }
  return size;
}
