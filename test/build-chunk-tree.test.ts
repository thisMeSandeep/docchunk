// Checks buildChunkTree: roots, children in order, and agreement with parentId and childIds.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildChunkTree, type ChunkTreeNode, chunkDocument } from "../src/index";

const content = readFileSync("test/fixtures/markdown/nested-headings.md", "utf8");

/** Returns every node in the tree, parents before their children. */
function allNodes(nodes: ChunkTreeNode[]): ChunkTreeNode[] {
  const collected: ChunkTreeNode[] = [];
  for (const node of nodes) {
    collected.push(node, ...allNodes(node.children));
  }
  return collected;
}

describe("buildChunkTree", () => {
  it("nests the heading tree: each node's children match its chunk's childIds", async () => {
    const { chunks } = await chunkDocument(
      { content, format: "markdown" },
      { strategy: "hierarchical", by: "heading" },
    );
    const roots = buildChunkTree(chunks);
    expect(roots.map((node) => node.chunk.level)).toEqual([0, 0, 0]);
    for (const node of allNodes(roots)) {
      expect(node.children.map((child) => child.chunk.id)).toEqual(node.chunk.childIds);
    }
    expect(allNodes(roots)).toHaveLength(chunks.length);
  });

  it("puts subsections under their section", async () => {
    const { chunks } = await chunkDocument(
      { content, format: "markdown" },
      { strategy: "hierarchical", by: "heading" },
    );
    const chapterOne = buildChunkTree(chunks)[1];
    const childTitles = chapterOne?.children.map((child) => child.chunk.headingPath.at(-1));
    expect(childTitles).toEqual(["Section 1.1", "Setup with bun and care"]);
    expect(chapterOne?.children[0]?.children[0]?.chunk.headingPath.at(-1)).toBe("Subsection 1.1.1");
  });

  it("makes every chunk a root when there are no parents", async () => {
    const { chunks } = await chunkDocument({ content, format: "markdown" });
    const roots = buildChunkTree(chunks);
    expect(roots.map((node) => node.chunk)).toEqual(chunks);
    expect(roots.every((node) => node.children.length === 0)).toBe(true);
  });

  it("makes a chunk whose parent was filtered out a root", async () => {
    const { chunks } = await chunkDocument(
      { content, format: "markdown" },
      { strategy: "parent-child", parentSize: 400, childSize: 100 },
    );
    const childrenOnly = chunks.filter((chunk) => chunk.level === 1);
    expect(buildChunkTree(childrenOnly)).toHaveLength(childrenOnly.length);
  });

  it("returns an empty tree for no chunks", () => {
    expect(buildChunkTree([])).toEqual([]);
  });
});
