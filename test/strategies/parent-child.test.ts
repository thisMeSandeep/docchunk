// Checks the parent-child strategy: two linked levels within their sizes, and the retrieval example from PRD 8.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chunkDocument } from "../../src/index";
import { parentChildStrategy } from "../../src/strategies/parent-child";

const content = readFileSync("test/fixtures/markdown/long-list.md", "utf8");

describe("parent-child strategy", () => {
  it("has the defaults from PRD 6.1", () => {
    expect(parentChildStrategy.defaults).toEqual({ parentSize: 4000, childSize: 800 });
  });

  it("returns parents at level 0 and children at level 1, each within its size", async () => {
    const result = await chunkDocument(
      { content, format: "markdown" },
      { strategy: "parent-child", parentSize: 1500, childSize: 400 },
    );
    const parents = result.chunks.filter((chunk) => chunk.level === 0);
    const children = result.chunks.filter((chunk) => chunk.level === 1);
    expect(parents.length).toBeGreaterThan(1);
    expect(children.length).toBeGreaterThan(parents.length);
    for (const parent of parents) {
      expect(parent.charCount).toBeLessThanOrEqual(1500);
    }
    for (const child of children) {
      expect(child.charCount).toBeLessThanOrEqual(400);
    }
  });

  it("supports the retrieval pattern: embed children, look up each child's parent", async () => {
    const { chunks: all } = await chunkDocument(
      { content, format: "markdown" },
      { strategy: "parent-child", parentSize: 1500, childSize: 400 },
    );
    const children = all.filter((chunk) => chunk.level === 1);
    const chunksById = new Map(all.map((chunk) => [chunk.id, chunk]));
    for (const child of children) {
      const parent = chunksById.get(child.parentId ?? "");
      expect(parent?.level).toBe(0);
      expect(parent?.text).toContain(child.text.split("\n")[0] ?? "");
    }
  });

  it("gives the same chunks as hierarchical with the same two levels", async () => {
    const parentChild = await chunkDocument(
      { content, format: "markdown" },
      { strategy: "parent-child", parentSize: 1500, childSize: 400 },
    );
    const hierarchical = await chunkDocument(
      { content, format: "markdown" },
      { strategy: "hierarchical", levels: [1500, 400] },
    );
    const ranges = (chunks: typeof parentChild.chunks) =>
      chunks.map((chunk) => [chunk.level, chunk.start, chunk.end]);
    expect(ranges(parentChild.chunks)).toEqual(ranges(hierarchical.chunks));
  });

  it("rejects a childSize that is not smaller than parentSize", () => {
    const validate = () => parentChildStrategy.validate({ parentSize: 800, childSize: 800 });
    expect(validate).toThrow('Option "childSize" must be less than "parentSize" (800), got 800.');
  });
});
