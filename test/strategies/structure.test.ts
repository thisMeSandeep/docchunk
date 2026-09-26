// Checks the structure strategy end to end: packing, sections, whole tables and code, the cascade, merging, and overlap.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type ChunkOptions, chunkDocument } from "../../src/index";
import { structureStrategy } from "../../src/strategies/structure";

/** Reads a Markdown fixture. */
function readFixture(name: string): string {
  return readFileSync(`test/fixtures/markdown/${name}`, "utf8");
}

/** Chunks Markdown content and returns the chunk texts. */
async function chunkTexts(content: string, options?: ChunkOptions): Promise<string[]> {
  const result = await chunkDocument({ content, format: "markdown" }, options);
  return result.chunks.map((chunk) => chunk.text);
}

describe("structure strategy packing", () => {
  it("is the default strategy", async () => {
    const content = readFixture("nested-headings.md");
    const withDefault = await chunkDocument({ content, format: "markdown" });
    const named = await chunkDocument({ content, format: "markdown" }, { strategy: "structure" });
    expect(withDefault.chunks).toEqual(named.chunks);
  });

  it("makes one chunk per section when sections are small, never joining sections", async () => {
    const content = readFixture("nested-headings.md");
    const result = await chunkDocument({ content, format: "markdown" });
    expect(result.chunks.map((chunk) => chunk.headingPath)).toEqual([
      [],
      ["Chapter One"],
      ["Chapter One", "Section 1.1"],
      ["Chapter One", "Section 1.1", "Subsection 1.1.1"],
      ["Chapter One", "Setup with bun and care"],
      ["Chapter Two"],
    ]);
    // The level-4 heading is below the heading level, so it stays in the subsection's chunk.
    expect(result.chunks[3]?.text).toContain("#### Detail 1.1.1.1");
  });

  it("uses headingLevel to decide where sections start", async () => {
    const content = readFixture("nested-headings.md");
    const texts = await chunkTexts(content, { headingLevel: 1 });
    expect(texts).toHaveLength(3);
    expect(texts[1]?.startsWith("# Chapter One")).toBe(true);
    expect(texts[2]?.startsWith("# Chapter Two")).toBe(true);
  });

  it("keeps a table and a code block whole when they fit", async () => {
    const content = readFixture("mixed-blocks.md");
    const texts = await chunkTexts(content, { size: 120, minSize: 10 });
    const table = "| Name | Role |\n|---|---|\n| Asha | Writer |\n| Kenji | Reviewer |";
    const code = '```ts\nconst greeting = "hello";\nconsole.log(greeting);\n```';
    expect(texts.some((text) => text.includes(table))).toBe(true);
    expect(texts.some((text) => text.includes(code))).toBe(true);
  });

  it("splits a table larger than size by rows, repeating the header", async () => {
    const content = readFixture("large-table.md");
    const result = await chunkDocument({ content, format: "markdown" }, { size: 500 });
    const tableChunks = result.chunks.filter((chunk) => chunk.blockTypes.includes("table"));
    expect(tableChunks.length).toBeGreaterThan(1);
    for (const chunk of tableChunks) {
      expect(chunk.charCount).toBeLessThanOrEqual(500);
      expect(chunk.text).toContain("| ID | Name | Description | Status |\n|---|---|---|---|\n");
    }
  });
});

describe("structure strategy small chunks", () => {
  it("merges a small chunk into the previous chunk when the result fits", async () => {
    const first = `${"a".repeat(40)}.`;
    const second = `${"b".repeat(40)}.`;
    const content = `${first} ${second} Tiny.\n\nNext paragraph.`;
    const texts = await chunkTexts(content, { size: 70, minSize: 20 });
    expect(texts).toEqual([first, `${second} Tiny.\n\nNext paragraph.`]);
  });

  it("merges a small chunk into the next chunk when the previous one is too full", async () => {
    const long = `${"a".repeat(59)}.`;
    const content = `${long} Tiny.\n\nNext.`;
    const texts = await chunkTexts(content, { size: 62, minSize: 20 });
    expect(texts).toEqual([long, "Tiny.\n\nNext."]);
  });
});

describe("structure strategy overlap", () => {
  const sentences = ["First sentence here.", "Second one here.", "Third one here.", "Last one."];
  const content = sentences.join(" ");

  it("starts each chunk with whole sentences from the end of the previous chunk", async () => {
    const result = await chunkDocument(
      { content, format: "markdown" },
      { size: 45, minSize: 1, overlapChars: 16 },
    );
    const texts = result.chunks.map((chunk) => chunk.text);
    expect(texts).toEqual([
      "First sentence here. Second one here.",
      "Second one here. Third one here. Last one.",
    ]);
  });

  it("adds no overlap when it would push the chunk over size", async () => {
    const result = await chunkDocument(
      { content, format: "markdown" },
      { size: 40, minSize: 1, overlapChars: 16 },
    );
    expect(result.chunks.map((chunk) => chunk.text)).toEqual([
      "First sentence here. Second one here.",
      "Third one here. Last one.",
    ]);
  });

  it("does not overlap across sections", async () => {
    const twoSections = "# One\n\nAlpha sentence. Beta sentence.\n\n# Two\n\nGamma sentence.";
    const result = await chunkDocument(
      { content: twoSections, format: "markdown" },
      { size: 1000, overlapChars: 100 },
    );
    expect(result.chunks.map((chunk) => chunk.text)).toEqual([
      "# One\n\nAlpha sentence. Beta sentence.",
      "# Two\n\nGamma sentence.",
    ]);
  });
});

describe("structure strategy validation", () => {
  const defaults = structureStrategy.defaults;

  it("has the defaults from PRD 6.1", () => {
    expect(defaults).toEqual({ size: 1500, minSize: 200, overlapChars: 0, headingLevel: 3 });
  });

  it("rejects a heading level outside 1 to 6", () => {
    for (const headingLevel of [0, 7, 2.5]) {
      const validate = () => structureStrategy.validate({ ...defaults, headingLevel });
      expect(validate).toThrow('Option "headingLevel" must be an integer from 1 to 6');
    }
  });

  it("rejects minSize larger than size", () => {
    const validate = () => structureStrategy.validate({ ...defaults, size: 100, minSize: 101 });
    expect(validate).toThrow('Option "minSize" must be at most "size" (100), got 101.');
  });
});
