// Splits a table that is larger than `size` into pieces of rows, each starting with the table's header (PRD 6.3).
import type { Block } from "../ir/ir-types";
import { measure } from "../output/measure";
import type { RawChunk } from "../strategies/strategy-types";
import { groupParts, groupsToRawChunks, oversizedPieces } from "./group-parts";

/** Returns pieces of at most `size` characters. Every piece after the first repeats the header and delimiter rows. */
export function splitTable(markdown: string, table: Block, size: number): RawChunk[] {
  const header = table.headerPart;
  const rows = table.parts ?? [];
  const firstRow = rows[0];
  if (header === undefined || firstRow === undefined) {
    return groupsToRawChunks(markdown, groupParts([table], size), size);
  }
  // The header and the newline after it count toward size.
  const headerCost = measure(header.start, header.end) + 1;
  const rowBudget = size - headerCost;
  if (rowBudget < 1) {
    // The header alone fills `size`, so it cannot be repeated. Split the header and rows like list items.
    return groupsToRawChunks(markdown, groupParts([header, ...rows], size), size);
  }
  const pieces: RawChunk[] = [];
  for (const group of groupParts(rows, rowBudget)) {
    if (group.isOversized && group.start === firstRow.start) {
      // The header cannot join a row that is too large, so it becomes its own piece and stays covered.
      pieces.push({ start: header.start, end: header.end });
      pieces.push(...oversizedPieces(markdown, group, size));
    } else if (group.isOversized) {
      pieces.push(...oversizedPieces(markdown, group, size));
    } else if (group.start === firstRow.start) {
      // The first rows sit right under the header, so the piece takes the header from the table itself.
      pieces.push({ start: table.start, end: group.end });
    } else {
      pieces.push({ start: group.start, end: group.end, prefix: header });
    }
  }
  return pieces;
}
