// Parses normalized Markdown into the flat list of top-level blocks that strategies read.
import type { Nodes, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import {
  type CodeParts,
  codeParts,
  listItemParts,
  tableHeaderPart,
  tableRowParts,
} from "./block-parts";
import type { Block, BlockType } from "./ir-types";
import { nodeRange } from "./node-range";

/** mdast node types that become blocks of the same type. Every other node type becomes "other". */
const blockTypeByNodeType = new Map<string, BlockType>([
  ["heading", "heading"],
  ["paragraph", "paragraph"],
  ["list", "list"],
  ["table", "table"],
  ["code", "code"],
  ["blockquote", "blockquote"],
  ["thematicBreak", "thematicBreak"],
  ["html", "html"],
]);

/** A heading that is still open while walking the document: later blocks sit under it. */
interface OpenHeading {
  level: number;
  text: string;
}

/** Returns the top-level blocks of the Markdown, with heading paths and section ids. */
export function parseMarkdown(markdown: string, headingLevel: number): Block[] {
  const root = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  const blocks: Block[] = [];
  const openHeadings: OpenHeading[] = [];
  let sectionId = 0;
  for (const node of root.children) {
    if (node.type === "heading") {
      closeHeadingsAtOrBelow(openHeadings, node.depth);
      openHeadings.push({ level: node.depth, text: plainText(node).trim() });
      const isSectionStart = node.depth <= headingLevel;
      if (isSectionStart) {
        sectionId++;
      }
    }
    blocks.push(createBlock(node, markdown, openHeadings, sectionId));
  }
  return blocks;
}

/** Builds the block for one top-level node. */
function createBlock(
  node: RootContent,
  markdown: string,
  openHeadings: OpenHeading[],
  sectionId: number,
): Block {
  const range = nodeRange(node);
  const headingPath: string[] = [];
  for (const openHeading of openHeadings) {
    headingPath.push(openHeading.text);
  }
  const block: Block = {
    type: blockTypeByNodeType.get(node.type) ?? "other",
    start: range.start,
    end: range.end,
    headingPath,
    sectionId,
  };
  addTypeSpecificFields(block, node, markdown);
  return block;
}

/** Adds the fields only some block types have: heading level, and list, table, or code parts. */
function addTypeSpecificFields(block: Block, node: RootContent, markdown: string): void {
  if (node.type === "heading") {
    block.level = node.depth;
  }
  if (node.type === "list") {
    block.parts = listItemParts(node);
  }
  if (node.type === "table") {
    block.headerPart = tableHeaderPart(node, markdown);
    block.parts = tableRowParts(node);
  }
  if (node.type === "code") {
    addCodeParts(block, codeParts(node, markdown));
  }
}

/** Removes open headings at the same level or deeper, since a new heading of this level ends them. */
function closeHeadingsAtOrBelow(openHeadings: OpenHeading[], level: number): void {
  let lastHeading = openHeadings.at(-1);
  while (lastHeading !== undefined && lastHeading.level >= level) {
    openHeadings.pop();
    lastHeading = openHeadings.at(-1);
  }
}

/** Returns the visible text of a node, without Markdown syntax: "Setup with `bun`" becomes "Setup with bun". */
function plainText(node: Nodes): string {
  if (node.type === "text" || node.type === "inlineCode") {
    return node.value;
  }
  if (!("children" in node)) {
    return "";
  }
  let text = "";
  for (const child of node.children) {
    text += plainText(child);
  }
  return text;
}

/** Sets a code block's line parts and, when it has them, its fence lines. */
function addCodeParts(block: Block, parts: CodeParts): void {
  block.parts = parts.lines;
  if (parts.openingFence !== undefined) {
    block.openingFence = parts.openingFence;
  }
  if (parts.closingFence !== undefined) {
    block.closingFence = parts.closingFence;
  }
}
