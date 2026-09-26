// Checks the paragraph strategy: one chunk per block, headings kept with the next block, and packing with a size.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chunkDocument } from "../../src/index";
import { paragraphStrategy } from "../../src/strategies/paragraph";

/** Chunks Markdown with the paragraph strategy and returns the chunk texts. */
async function paragraphTexts(content: string, size?: number): Promise<string[]> {
  const options =
    size === undefined
      ? { strategy: "paragraph" as const }
      : { strategy: "paragraph" as const, size };
  const result = await chunkDocument({ content, format: "markdown" }, options);
  return result.chunks.map((chunk) => chunk.text);
}

describe("paragraph strategy without a size", () => {
  it("makes one chunk per block, with each heading joined to the block after it", async () => {
    const content = readFileSync("test/fixtures/markdown/nested-headings.md", "utf8");
    const texts = await paragraphTexts(content);
    expect(texts).toHaveLength(7);
    expect(texts[1]).toBe("# Chapter One\n\nOpening paragraph of chapter one.");
    expect(texts[4]?.startsWith("#### Detail 1.1.1.1\n\nText under a level-four heading.")).toBe(
      true,
    );
  });

  it("gives lists, tables, and code their own chunks and drops a lone thematic break", async () => {
    const content = readFileSync("test/fixtures/markdown/mixed-blocks.md", "utf8");
    const texts = await paragraphTexts(content);
    expect(texts[0]).toBe("# Every block type\n\nA paragraph with **bold**, *italic*, and `code`.");
    expect(texts).toContain("| Name | Role |\n|---|---|\n| Asha | Writer |\n| Kenji | Reviewer |");
    expect(texts).not.toContain("---");
  });

  it("keeps a heading alone when the next block starts a new section", async () => {
    expect(await paragraphTexts("# A\n\n# B\n\nText.")).toEqual(["# A", "# B\n\nText."]);
  });

  it("keeps a heading at the end of the document as its own chunk", async () => {
    expect(await paragraphTexts("Text.\n\n# End")).toEqual(["Text.", "# End"]);
  });
});

describe("paragraph strategy with a size", () => {
  it("packs consecutive blocks up to size", async () => {
    expect(await paragraphTexts("One.\n\nTwo.\n\nThree.", 12)).toEqual(["One.\n\nTwo.", "Three."]);
  });

  it("has no size limit by default", () => {
    expect(paragraphStrategy.defaults.size).toBe(Number.POSITIVE_INFINITY);
  });
});
