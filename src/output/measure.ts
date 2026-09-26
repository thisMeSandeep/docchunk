// Measures the size of a range of the Markdown. Every size check in the library goes through here.

/** Returns the number of characters between two offsets. */
export function measure(start: number, end: number): number {
  return end - start;
}
