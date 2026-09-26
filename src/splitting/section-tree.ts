// Builds one chunk per section at every heading level up to headingLevel, nested by headings (hierarchical by heading).
import type { Block } from "../ir/ir-types";
import type { RawChunk } from "../strategies/strategy-types";

/** A section whose end is not known yet: it lasts until a heading at its level or higher. */
interface OpenSection {
  chunkIndex: number;
  headingLevel: number;
}

/** The section chunks, and for each one whether it contains smaller sections. */
export interface SectionTree {
  chunks: RawChunk[];
  hasChildSection: boolean[];
}

/** Returns one chunk per section. A section includes its subsections; its `level` is how deeply it is nested. */
export function buildSectionTree(blocks: Block[], headingLevel: number): SectionTree {
  const tree: SectionTree = { chunks: [], hasChildSection: [] };
  const openSections: OpenSection[] = [];
  let previousEnd = 0;
  for (const block of blocks) {
    const isSectionHeading =
      block.type === "heading" && block.level !== undefined && block.level <= headingLevel;
    if (isSectionHeading && block.level !== undefined) {
      closeSections(tree, openSections, block.level, previousEnd);
      openSection(tree, openSections, block, block.level);
    } else if (openSections.length === 0) {
      addToIntroduction(tree, block);
    }
    previousEnd = block.end;
  }
  closeSections(tree, openSections, 0, previousEnd);
  return tree;
}

/** Starts a section at a heading, nested inside the innermost open section. */
function openSection(
  tree: SectionTree,
  openSections: OpenSection[],
  heading: Block,
  headingLevel: number,
): void {
  const chunk: RawChunk = { start: heading.start, end: heading.end, level: openSections.length };
  const parent = openSections.at(-1);
  if (parent !== undefined) {
    chunk.parentIndex = parent.chunkIndex;
    tree.hasChildSection[parent.chunkIndex] = true;
  }
  tree.chunks.push(chunk);
  tree.hasChildSection.push(false);
  openSections.push({ chunkIndex: tree.chunks.length - 1, headingLevel });
}

/** Ends every open section at this heading level or deeper. Level 0 ends them all. */
function closeSections(
  tree: SectionTree,
  openSections: OpenSection[],
  headingLevel: number,
  end: number,
): void {
  let innermost = openSections.at(-1);
  while (innermost !== undefined && innermost.headingLevel >= headingLevel) {
    const chunk = tree.chunks[innermost.chunkIndex];
    if (chunk !== undefined) {
      chunk.end = end;
    }
    openSections.pop();
    innermost = openSections.at(-1);
  }
}

/** Adds a block before the first heading to the introduction: one level-0 chunk. */
function addToIntroduction(tree: SectionTree, block: Block): void {
  const introduction = tree.chunks[0];
  if (introduction !== undefined) {
    introduction.end = block.end;
    return;
  }
  tree.chunks.push({ start: block.start, end: block.end, level: 0 });
  tree.hasChildSection.push(false);
}
