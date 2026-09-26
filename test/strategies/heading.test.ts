// Checks the heading strategy: one chunk per section, headingLevel, and splitting large sections with a size.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type ChunkOptions, type ChunkResult, chunkDocument } from "../../src/index";
import { headingStrategy } from "../../src/strategies/heading";

/** Chunks a fixture with the heading strategy. */
async function chunkFixture(
  name: string,
  headingOptions: { size?: number; headingLevel?: number } = {},
): Promise<ChunkResult> {
  const content = readFileSync(`test/fixtures/markdown/${name}`, "utf8");
  const options: ChunkOptions = { strategy: "heading", ...headingOptions };
  return chunkDocument({ content, format: "markdown" }, options);
}

describe("heading strategy", () => {
  it("makes one chunk per section, including the heading line", async () => {
    const result = await chunkFixture("nested-headings.md");
    const texts = result.chunks.map((chunk) => chunk.text);
    expect(texts).toHaveLength(6);
    expect(texts[0]?.startsWith("This paragraph comes before any heading.")).toBe(true);
    expect(texts[1]).toBe("# Chapter One\n\nOpening paragraph of chapter one.");
    expect(texts[3]).toContain("#### Detail 1.1.1.1");
  });

  it("uses headingLevel to decide where sections start", async () => {
    const result = await chunkFixture("nested-headings.md", { headingLevel: 1 });
    expect(result.chunks.map((chunk) => chunk.headingPath)).toEqual([
      [],
      ["Chapter One"],
      ["Chapter Two"],
    ]);
  });

  it("keeps a large section whole when no size is given", async () => {
    const result = await chunkFixture("large-table.md");
    expect(result.chunks).toHaveLength(1);
  });

  it("splits a section larger than size, repeating the table header", async () => {
    const result = await chunkFixture("large-table.md", { size: 500 });
    expect(result.chunks.length).toBeGreaterThan(1);
    for (const chunk of result.chunks) {
      expect(chunk.charCount).toBeLessThanOrEqual(500);
    }
    const tableChunks = result.chunks.filter((chunk) => chunk.blockTypes.includes("table"));
    for (const chunk of tableChunks) {
      expect(chunk.text).toContain("| ID | Name | Description | Status |\n|---|---|---|---|");
    }
  });

  it("rejects a heading level outside 1 to 6", () => {
    const validate = () =>
      headingStrategy.validate({ ...headingStrategy.defaults, headingLevel: 9 });
    expect(validate).toThrow('Option "headingLevel" must be an integer from 1 to 6, got 9.');
  });
});
