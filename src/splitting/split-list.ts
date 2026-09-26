// Splits a list that is larger than `size` into pieces of whole items (PRD 6.3).
import type { Block } from "../ir/ir-types";
import type { RawChunk } from "../strategies/strategy-types";
import { groupParts, groupsToRawChunks } from "./group-parts";

/** Returns pieces of at most `size` characters, each holding whole top-level items. */
export function splitList(markdown: string, list: Block, size: number): RawChunk[] {
  const items = list.parts ?? [list];
  return groupsToRawChunks(markdown, groupParts(items, size), size);
}
