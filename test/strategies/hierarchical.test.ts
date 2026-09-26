// Checks the hierarchical strategy: levels by size, the heading tree, parent and child links, and split pieces.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type Chunk, type ChunkOptions, type ChunkResult, chunkDocument } from "../../src/index";
import { hierarchicalStrategy } from "../../src/strategies/hierarchical";

/** Chunks a Markdown fixture with the hierarchical strategy. */
async function chunkFixture(
  name: string,
  hierarchicalOptions: {
    by?: "size" | "heading";
    levels?: number[];
    headingLevel?: number;
    leafSize?: number;
  },
  extraOptions: { headingPrefix?: boolean } = {},
): Promise<ChunkResult> {
  const content = readFileSync(`test/fixtures/markdown/${name}`, "utf8");
  const options: ChunkOptions = {
    strategy: "hierarchical",
    ...hierarchicalOptions,
    ...extraOptions,
  };
  return chunkDocument({ content, format: "markdown" }, options);
}

/** Returns the chunks at one level. */
function atLevel(result: ChunkResult, level: number): Chunk[] {
  return result.chunks.filter((chunk) => chunk.level === level);
}

/** Checks every child lies inside its parent, one level down, and the parent lists it in childIds. */
function expectLinksAgree(result: ChunkResult): void {
  const chunkById = new Map(result.chunks.map((chunk) => [chunk.id, chunk]));
  for (const chunk of result.chunks) {
    for (const childId of chunk.childIds ?? []) {
      expect(chunkById.get(childId)?.parentId).toBe(chunk.id);
    }
    if (chunk.parentId === undefined) {
      continue;
    }
    const parent = chunkById.get(chunk.parentId);
    expect(parent?.childIds).toContain(chunk.id);
    expect(parent?.level).toBe((chunk.level ?? 0) - 1);
    expect(chunk.start).toBeGreaterThanOrEqual(parent?.start ?? Number.NaN);
    expect(chunk.end).toBeLessThanOrEqual(parent?.end ?? Number.NaN);
  }
}

describe("hierarchical by size", () => {
  it("makes one level per size, each within its size, with linked parents and children", async () => {
    const result = await chunkFixture("long-paragraph.md", { levels: [2000, 600, 150] });
    for (const [level, size] of [2000, 600, 150].entries()) {
      const chunks = atLevel(result, level);
      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(chunk.charCount).toBeLessThanOrEqual(size);
      }
    }
    for (const chunk of atLevel(result, 0)) {
      expect(chunk.parentId).toBeUndefined();
      expect(chunk.childIds?.length).toBeGreaterThan(0);
    }
    expect(atLevel(result, 2).every((chunk) => chunk.childIds?.length === 0)).toBe(true);
    expectLinksAgree(result);
  });

  it("sorts by start, then by level, so a parent comes before its first child", async () => {
    const result = await chunkFixture("long-paragraph.md", { levels: [2000, 600] });
    expect(result.chunks[0]?.level).toBe(0);
    expect(result.chunks[1]?.level).toBe(1);
    expect(result.chunks[1]?.parentId).toBe(result.chunks[0]?.id);
  });

  it("gives a parent and a child with the same range different ids", async () => {
    const result = await chunkFixture("nested-headings.md", { levels: [2000, 1000] });
    const [parent, child] = result.chunks;
    expect(child?.start).toBe(parent?.start);
    expect(child?.end).toBe(parent?.end);
    expect(child?.id).not.toBe(parent?.id);
  });

  it("repeats the table header in children of split table pieces", async () => {
    const result = await chunkFixture("large-table.md", { levels: [1000, 300] });
    const tableChildren = atLevel(result, 1).filter((chunk) => chunk.blockTypes.includes("table"));
    expect(tableChildren.length).toBeGreaterThan(3);
    for (const chunk of tableChildren) {
      expect(chunk.charCount).toBeLessThanOrEqual(300);
      expect(chunk.text).toContain("| ID | Name | Description | Status |\n|---|---|---|---|\n");
    }
    expectLinksAgree(result);
  });

  it("wraps children of split code pieces in the fence", async () => {
    const result = await chunkFixture("long-code-block.md", { levels: [1000, 300] });
    const codeChildren = atLevel(result, 1).filter((chunk) => chunk.blockTypes.includes("code"));
    expect(codeChildren.length).toBeGreaterThan(3);
    for (const chunk of codeChildren) {
      expect(chunk.charCount).toBeLessThanOrEqual(300);
      expect(chunk.text.startsWith("```ts\n")).toBe(true);
      // The last piece can be merged with the paragraph after the code, so the fence may not be last.
      expect(chunk.text).toContain("\n```");
    }
    expectLinksAgree(result);
  });

  it("keeps children inside a parent whose range starts with whitespace (found by fast-check)", async () => {
    // The last parent is a hard-cut piece " 🇮🇳 😀"; finalize trims its leading space, so its children must not include it.
    const content = "```\nFamilies 👨‍👩‍👧‍👦 and flags 🇮🇳 😀";
    const result = await chunkDocument(
      { content, format: "markdown" },
      { strategy: "parent-child", parentSize: 30, childSize: 12 },
    );
    expectLinksAgree(result);
  });

  it("keeps every level within its size with headingPrefix on", async () => {
    const result = await chunkFixture(
      "large-table.md",
      { levels: [1000, 300] },
      { headingPrefix: true },
    );
    for (const chunk of result.chunks) {
      const size = chunk.level === 0 ? 1000 : 300;
      expect(chunk.charCount).toBeLessThanOrEqual(size);
    }
  });
});

describe("hierarchical by heading", () => {
  it("makes one chunk per section at each heading depth, nested by headings", async () => {
    const result = await chunkFixture("nested-headings.md", { by: "heading" });
    const summary = result.chunks.map((chunk) => [chunk.level, chunk.headingPath.at(-1) ?? ""]);
    expect(summary).toEqual([
      [0, ""],
      [0, "Chapter One"],
      [1, "Section 1.1"],
      [2, "Subsection 1.1.1"],
      [1, "Setup with bun and care"],
      [0, "Chapter Two"],
    ]);
    expectLinksAgree(result);
  });

  it("includes subsections in their parent section", async () => {
    const result = await chunkFixture("nested-headings.md", { by: "heading" });
    const chapterOne = result.chunks[1];
    expect(chapterOne?.text.startsWith("# Chapter One")).toBe(true);
    expect(chapterOne?.text).toContain("## Setup with `bun` and *care*");
    expect(chapterOne?.text).not.toContain("# Chapter Two");
  });

  it("splits a section without subsections that is larger than leafSize", async () => {
    const result = await chunkFixture("large-table.md", { by: "heading", leafSize: 500 });
    expect(atLevel(result, 0)).toHaveLength(1);
    const children = atLevel(result, 1);
    expect(children.length).toBeGreaterThan(1);
    for (const chunk of children) {
      expect(chunk.charCount).toBeLessThanOrEqual(500);
    }
    expectLinksAgree(result);
  });

  it("warns about sections over 8,000 characters, and never for levels by size", async () => {
    const content = `# Big\n\n${"word ".repeat(1800)}`;
    const byHeading = await chunkDocument(
      { content, format: "markdown" },
      { strategy: "hierarchical", by: "heading" },
    );
    expect(byHeading.warnings.map((warning) => warning.code)).toEqual(["LARGE_CHUNK"]);
    const bySize = await chunkDocument(
      { content, format: "markdown" },
      { strategy: "hierarchical", levels: [9000, 1000] },
    );
    expect(bySize.warnings).toEqual([]);
  });
});

describe("hierarchical validation", () => {
  const defaults = hierarchicalStrategy.defaults;

  it("has the defaults from PRD 6.1", () => {
    expect(defaults).toEqual({
      by: "size",
      levels: [6000, 1500, 400],
      headingLevel: 3,
      leafSize: 1500,
    });
  });

  it("rejects levels that are empty or not strictly decreasing", () => {
    for (const levels of [[], [100, 100], [100, 200], [100, 0]]) {
      const validate = () => hierarchicalStrategy.validate({ ...defaults, levels });
      expect(validate).toThrow('Option "levels" must be a non-empty array of positive integers');
    }
  });

  it("rejects an unknown by value", () => {
    // @ts-expect-error JavaScript callers can pass any value.
    const validate = () => hierarchicalStrategy.validate({ ...defaults, by: "page" });
    expect(validate).toThrow('Option "by" must be one of "size", "heading", got page.');
  });
});
