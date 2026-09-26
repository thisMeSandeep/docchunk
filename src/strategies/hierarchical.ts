// The hierarchical strategy: nested chunks at several sizes, or following the heading tree (PRD 6.2).
import type { Block, DocumentIR } from "../ir/ir-types";
import {
  checkDecreasingSizes,
  checkIntegerBetween,
  checkOneOf,
  checkPositiveInteger,
} from "../options/option-checks";
import { measure } from "../output/measure";
import { clipBlocks } from "../splitting/clip-blocks";
import { buildSectionTree } from "../splitting/section-tree";
import type { RawChunk, StrategyDefinition } from "./strategy-types";
import { structureStrategy } from "./structure";

/** minSize used for each level's structure run, unless the level's size is smaller. */
const levelMinSize = 200;

export const hierarchicalStrategy: StrategyDefinition<"hierarchical"> = {
  name: "hierarchical",
  defaults: { by: "size", levels: [6000, 1500, 400], headingLevel: 3, leafSize: 1500 },
  validate: (options) => {
    checkOneOf("by", options.by, ["size", "heading"]);
    checkDecreasingSizes("levels", options.levels);
    checkIntegerBetween("headingLevel", options.headingLevel, 1, 6);
    checkPositiveInteger("leafSize", options.leafSize);
  },
  split: (ir, options) => {
    if (options.by === "heading") {
      return splitByHeading(ir, options.headingLevel, options.leafSize);
    }
    return splitBySize(ir, options.levels, options.headingLevel);
  },
};

/** Level 0 is structure at levels[0]; every chunk of level n is re-chunked inside itself at levels[n + 1]. */
export function splitBySize(ir: DocumentIR, levels: number[], headingLevel: number): RawChunk[] {
  const allChunks: RawChunk[] = [];
  let parentIndexes: number[] = [];
  for (const [level, size] of levels.entries()) {
    const nextParentIndexes: number[] = [];
    // Level 0 has one "parent": the whole document.
    const parents = level === 0 ? [undefined] : parentIndexes;
    for (const parentIndex of parents) {
      const parent = parentIndex === undefined ? undefined : allChunks[parentIndex];
      const blocks = parent === undefined ? ir.blocks : clipBlocks(ir.blocks, parent);
      for (const chunk of structureAtSize(ir.markdown, blocks, size, headingLevel)) {
        allChunks.push(withLevel(chunk, level, parentIndex));
        nextParentIndexes.push(allChunks.length - 1);
      }
    }
    parentIndexes = nextParentIndexes;
  }
  return allChunks;
}

/** One chunk per section at each heading depth. A section without subsections that is larger than leafSize gets children. */
function splitByHeading(ir: DocumentIR, headingLevel: number, leafSize: number): RawChunk[] {
  const tree = buildSectionTree(ir.blocks, headingLevel);
  const allChunks: RawChunk[] = [...tree.chunks];
  for (const [sectionIndex, section] of tree.chunks.entries()) {
    const isLargeLeaf =
      tree.hasChildSection[sectionIndex] !== true && measure(section.start, section.end) > leafSize;
    if (!isLargeLeaf) {
      continue;
    }
    const blocks = clipBlocks(ir.blocks, section);
    const childLevel = (section.level ?? 0) + 1;
    for (const chunk of structureAtSize(ir.markdown, blocks, leafSize, headingLevel)) {
      allChunks.push(withLevel(chunk, childLevel, sectionIndex));
    }
  }
  return allChunks;
}

/** Runs the structure strategy on some blocks at one size. */
function structureAtSize(
  markdown: string,
  blocks: Block[],
  size: number,
  headingLevel: number,
): RawChunk[] {
  const options = {
    size,
    minSize: Math.min(levelMinSize, size),
    overlapChars: 0,
    headingLevel,
  };
  return structureStrategy.split({ markdown, blocks }, options);
}

/** Returns the chunk with its level and, below level 0, its parent's position. */
function withLevel(chunk: RawChunk, level: number, parentIndex: number | undefined): RawChunk {
  const leveled: RawChunk = { ...chunk, level };
  if (parentIndex !== undefined) {
    leveled.parentIndex = parentIndex;
  }
  return leveled;
}
