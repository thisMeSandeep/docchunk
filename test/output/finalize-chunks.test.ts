// Checks that finalizeChunks trims, drops, sorts, and fills in every chunk field.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DocumentIR } from "../../src/ir/ir-types";
import { normalizeMarkdown } from "../../src/ir/normalize-markdown";
import { parseMarkdown } from "../../src/ir/parse-markdown";
import { resolveOptions } from "../../src/options/resolve-options";
import { finalizeChunks } from "../../src/output/finalize-chunks";
import { hashText } from "../../src/output/hash";

const fixedOptions = resolveOptions({ strategy: "fixed" });

/** Builds the IR for a Markdown fixture. */
function buildFixtureIR(name: string): DocumentIR {
  const markdown = normalizeMarkdown(readFileSync(`test/fixtures/markdown/${name}`, "utf8"));
  return { markdown, blocks: parseMarkdown(markdown, 3) };
}

/** Returns the offset of the first occurrence of the text. Fails the test if it is missing. */
function offsetOf(markdown: string, text: string): number {
  const offset = markdown.indexOf(text);
  if (offset === -1) {
    throw new Error(`"${text}" not found`);
  }
  return offset;
}

describe("finalizeChunks ranges", () => {
  it("trims whitespace and moves start and end to the trimmed text", () => {
    const ir = buildFixtureIR("nested-headings.md");
    const headingStart = offsetOf(ir.markdown, "# Chapter One");
    const rawChunk = { start: headingStart - 2, end: headingStart + "# Chapter One".length + 2 };
    const [chunk] = finalizeChunks(ir, [rawChunk], fixedOptions, "doc");
    expect(chunk?.text).toBe("# Chapter One");
    expect(chunk?.start).toBe(headingStart);
    expect(chunk?.end).toBe(headingStart + "# Chapter One".length);
  });

  it("drops ranges that are empty or only whitespace", () => {
    const ir = buildFixtureIR("nested-headings.md");
    const blankLine = offsetOf(ir.markdown, "\n\n");
    const rawChunks = [
      { start: 5, end: 5 },
      { start: blankLine, end: blankLine + 2 },
    ];
    expect(finalizeChunks(ir, rawChunks, fixedOptions, "doc")).toEqual([]);
  });

  it("drops a range that holds only a thematic break", () => {
    const ir = buildFixtureIR("mixed-blocks.md");
    const breakStart = offsetOf(ir.markdown, "\n---\n") + 1;
    const rawChunk = { start: breakStart - 1, end: breakStart + 4 };
    expect(finalizeChunks(ir, [rawChunk], fixedOptions, "doc")).toEqual([]);
  });

  it("sorts chunks by start and numbers them from 0", () => {
    const ir = buildFixtureIR("nested-headings.md");
    const rawChunks = [
      { start: 200, end: 260 },
      { start: 0, end: 50 },
      { start: 100, end: 150 },
    ];
    const chunks = finalizeChunks(ir, rawChunks, fixedOptions, "doc");
    expect(chunks.map((chunk) => chunk.index)).toEqual([0, 1, 2]);
    expect(chunks.map((chunk) => chunk.start)).toEqual([0, 100, 200]);
  });

  it("gives every chunk text equal to its slice of the Markdown", () => {
    const ir = buildFixtureIR("mixed-blocks.md");
    const rawChunks = [
      { start: 0, end: 120 },
      { start: 120, end: ir.markdown.length },
    ];
    for (const chunk of finalizeChunks(ir, rawChunks, fixedOptions, "doc")) {
      expect(chunk.text).toBe(ir.markdown.slice(chunk.start, chunk.end));
      expect(chunk.charCount).toBe(chunk.text.length);
    }
  });
});

describe("finalizeChunks headings and block types", () => {
  it("uses the heading path of the block where the chunk starts", () => {
    const ir = buildFixtureIR("nested-headings.md");
    const start = offsetOf(ir.markdown, "Text in section 1.1.");
    const end = offsetOf(ir.markdown, "Text in subsection") + 10;
    const [chunk] = finalizeChunks(ir, [{ start, end }], fixedOptions, "doc");
    expect(chunk?.headingPath).toEqual(["Chapter One", "Section 1.1"]);
  });

  it("gives content before the first heading an empty heading path", () => {
    const ir = buildFixtureIR("nested-headings.md");
    const [chunk] = finalizeChunks(ir, [{ start: 0, end: 30 }], fixedOptions, "doc");
    expect(chunk?.headingPath).toEqual([]);
  });

  it("lists the block types a chunk touches, in order, each once", () => {
    const ir = buildFixtureIR("mixed-blocks.md");
    const start = offsetOf(ir.markdown, "- First item");
    const end = offsetOf(ir.markdown, "| Asha");
    const [chunk] = finalizeChunks(ir, [{ start, end }], fixedOptions, "doc");
    expect(chunk?.blockTypes).toEqual(["list", "table"]);
  });
});

describe("finalizeChunks ids, hashes, and metadata", () => {
  const ir = buildFixtureIR("nested-headings.md");
  const rawChunk = { start: 0, end: 40 };

  it("gives 20-character hex ids and content hashes", () => {
    const [chunk] = finalizeChunks(ir, [rawChunk], fixedOptions, "doc");
    expect(chunk?.id).toMatch(/^[0-9a-f]{20}$/);
    expect(chunk?.contentHash).toBe(hashText(chunk?.text ?? ""));
  });

  it("gives the same id every time for the same input", () => {
    const first = finalizeChunks(ir, [rawChunk], fixedOptions, "doc");
    const second = finalizeChunks(ir, [rawChunk], fixedOptions, "doc");
    expect(second).toEqual(first);
  });

  it("changes the id when the document id, options, or range change", () => {
    const [base] = finalizeChunks(ir, [rawChunk], fixedOptions, "doc");
    const [otherDocument] = finalizeChunks(ir, [rawChunk], fixedOptions, "other-doc");
    const charOptions = resolveOptions({ strategy: "fixed", boundary: "char" });
    const [otherOptions] = finalizeChunks(ir, [rawChunk], charOptions, "doc");
    const [otherRange] = finalizeChunks(ir, [{ start: 0, end: 45 }], fixedOptions, "doc");
    const ids = new Set([base?.id, otherDocument?.id, otherOptions?.id, otherRange?.id]);
    expect(ids.size).toBe(4);
  });

  it("gives the same id to ranges that differ only by surrounding whitespace", () => {
    // Character 40 is the space after "heading.", so both ranges trim to 0-40.
    const [withoutSpace] = finalizeChunks(ir, [{ start: 0, end: 40 }], fixedOptions, "doc");
    const [withSpace] = finalizeChunks(ir, [{ start: 0, end: 41 }], fixedOptions, "doc");
    expect(withSpace?.id).toBe(withoutSpace?.id);
  });

  it("keeps the id when only metadata changes", () => {
    const withMetadata = resolveOptions({ strategy: "fixed", metadata: { team: "legal" } });
    const [plain] = finalizeChunks(ir, [rawChunk], fixedOptions, "doc");
    const [tagged] = finalizeChunks(ir, [rawChunk], withMetadata, "doc");
    expect(tagged?.id).toBe(plain?.id);
    expect(tagged?.metadata).toEqual({ team: "legal" });
  });

  it("gives each chunk its own copy of the metadata", () => {
    const options = resolveOptions({ strategy: "fixed", metadata: { team: "legal" } });
    const chunks = finalizeChunks(
      ir,
      [
        { start: 0, end: 40 },
        { start: 100, end: 140 },
      ],
      options,
      "doc",
    );
    const firstChunk = chunks[0];
    if (firstChunk !== undefined) {
      firstChunk.metadata.team = "changed";
    }
    expect(chunks[1]?.metadata).toEqual({ team: "legal" });
    expect(options.metadata).toEqual({ team: "legal" });
  });
});
