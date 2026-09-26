// Checks the headingPrefix option (text, size, ids) and the LARGE_CHUNK warning.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type ChunkOptions, chunkDocument, DocchunkError } from "../src/index";
import { hashText } from "../src/output/hash";

/** Chunks a Markdown fixture with the given options. */
async function chunkFixture(name: string, options?: ChunkOptions) {
  const content = readFileSync(`test/fixtures/markdown/${name}`, "utf8");
  return chunkDocument({ content, format: "markdown" }, options);
}

describe("headingPrefix", () => {
  it("prepends the heading path and a blank line, and leaves chunks without headings alone", async () => {
    const result = await chunkFixture("nested-headings.md", { headingPrefix: true });
    expect(result.chunks[0]?.text.startsWith("This paragraph comes before any heading.")).toBe(
      true,
    );
    expect(result.chunks[2]?.text).toBe(
      "Chapter One > Section 1.1\n\n## Section 1.1\n\nText in section 1.1.",
    );
  });

  it("keeps start and end on the Markdown range and hashes the prefixed text", async () => {
    const result = await chunkFixture("nested-headings.md", { headingPrefix: true });
    const chunk = result.chunks[1];
    expect(result.document.markdown.slice(chunk?.start, chunk?.end)).toBe(
      "# Chapter One\n\nOpening paragraph of chapter one.",
    );
    expect(chunk?.contentHash).toBe(hashText(chunk?.text ?? ""));
    expect(chunk?.charCount).toBe(chunk?.text.length);
  });

  it("counts the prefix toward size", async () => {
    const result = await chunkFixture("large-table.md", { size: 500, headingPrefix: true });
    expect(result.chunks.length).toBeGreaterThan(1);
    for (const chunk of result.chunks) {
      expect(chunk.charCount).toBeLessThanOrEqual(500);
      expect(chunk.text.startsWith("Task table\n\n")).toBe(true);
    }
    const fixed = await chunkFixture("long-list.md", {
      strategy: "fixed",
      size: 300,
      headingPrefix: true,
    });
    for (const chunk of fixed.chunks) {
      expect(chunk.charCount).toBeLessThanOrEqual(300);
    }
  });

  it("changes chunk ids", async () => {
    const plain = await chunkFixture("nested-headings.md");
    const prefixed = await chunkFixture("nested-headings.md", { headingPrefix: true });
    expect(prefixed.chunks[1]?.id).not.toBe(plain.chunks[1]?.id);
  });

  it("rejects a size with no room left after the longest heading path", async () => {
    const reject = chunkFixture("nested-headings.md", {
      size: 40,
      minSize: 1,
      headingPrefix: true,
    });
    await expect(reject).rejects.toThrow(DocchunkError);
    await expect(reject).rejects.toThrow('Option "headingPrefix" needs up to 63 characters');
  });

  it("adds nothing to plain text, which has no headings", async () => {
    const result = await chunkDocument(
      { content: "# Not a heading\n\nText.", format: "text" },
      { strategy: "paragraph", headingPrefix: true },
    );
    expect(result.chunks.map((chunk) => chunk.text)).toEqual(["# Not a heading", "Text."]);
  });
});

describe("LARGE_CHUNK warning", () => {
  const longParagraph = "word ".repeat(1700).trim();

  it("warns about a chunk over 8,000 characters when the strategy has no size limit", async () => {
    const result = await chunkDocument(
      { content: `# Long\n\n${longParagraph}`, format: "markdown" },
      { strategy: "heading" },
    );
    expect(result.warnings).toEqual([
      {
        code: "LARGE_CHUNK",
        message: `Chunk 0 has ${result.chunks[0]?.charCount} characters, more than 8000. Set "size" to split it.`,
        chunkIndex: 0,
      },
    ]);
  });

  it("does not warn when the strategy has a size limit", async () => {
    const withSize = await chunkDocument(
      { content: longParagraph, format: "markdown" },
      { strategy: "paragraph", size: 9000 },
    );
    expect(withSize.chunks[0]?.charCount).toBeGreaterThan(8000);
    expect(withSize.warnings).toEqual([]);
  });

  it("does not warn at exactly 8,000 characters", async () => {
    const result = await chunkDocument(
      { content: "x".repeat(8000), format: "markdown" },
      { strategy: "paragraph" },
    );
    expect(result.warnings).toEqual([]);
  });
});
