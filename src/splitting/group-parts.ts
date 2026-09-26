// Packs consecutive parts of a block (rows, items, or lines) into groups that fit a size budget.
import type { Range } from "../ir/ir-types";
import { measure } from "../output/measure";
import type { RawChunk } from "../strategies/strategy-types";
import { hardCut } from "./hard-cut";

/** A run of consecutive parts, measured from the first part's start to the last part's end. */
export interface PartGroup extends Range {
  /** True when the group is a single part larger than the budget. */
  isOversized: boolean;
}

/** Returns groups of at most `budget` characters. A part larger than the budget on its own becomes an oversized group. */
export function groupParts(parts: Range[], budget: number): PartGroup[] {
  const groups: PartGroup[] = [];
  let current: Range | undefined;
  for (const part of parts) {
    if (measure(part.start, part.end) > budget) {
      addGroup(groups, current);
      current = undefined;
      groups.push({ start: part.start, end: part.end, isOversized: true });
      continue;
    }
    if (current !== undefined && measure(current.start, part.end) > budget) {
      addGroup(groups, current);
      current = undefined;
    }
    current = { start: current?.start ?? part.start, end: part.end };
  }
  addGroup(groups, current);
  return groups;
}

/** Returns the groups as raw chunks. Oversized groups are hard-cut into pieces of at most `size`. */
export function groupsToRawChunks(markdown: string, groups: PartGroup[], size: number): RawChunk[] {
  const rawChunks: RawChunk[] = [];
  for (const group of groups) {
    if (group.isOversized) {
      rawChunks.push(...oversizedPieces(markdown, group, size));
    } else {
      rawChunks.push({ start: group.start, end: group.end });
    }
  }
  return rawChunks;
}

/** Hard-cuts a range that is too large and marks every piece as oversized. */
export function oversizedPieces(markdown: string, range: Range, size: number): RawChunk[] {
  const rawChunks: RawChunk[] = [];
  for (const piece of hardCut(markdown, range, size)) {
    rawChunks.push({ start: piece.start, end: piece.end, isOversized: true });
  }
  return rawChunks;
}

/** Adds a group that fits the budget, if there is one. */
function addGroup(groups: PartGroup[], range: Range | undefined): void {
  if (range !== undefined) {
    groups.push({ start: range.start, end: range.end, isOversized: false });
  }
}
