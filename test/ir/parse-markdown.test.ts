// Checks block types, offsets, heading paths, and section ids produced by parseMarkdown.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Block } from "../../src/ir/ir-types";
import { normalizeMarkdown } from "../../src/ir/normalize-markdown";
import { parseMarkdown } from "../../src/ir/parse-markdown";

const defaultHeadingLevel = 3;

/** Reads a Markdown fixture and normalizes it. */
function readFixture(name: string): string {
  const raw = readFileSync(`test/fixtures/markdown/${name}`, "utf8");
  return normalizeMarkdown(raw);
}

/** Returns the Markdown text a block covers. */
function blockText(markdown: string, block: Block): string {
  return markdown.slice(block.start, block.end);
}

describe("parseMarkdown", () => {
  it("finds every block type in order", () => {
    const markdown = readFixture("mixed-blocks.md");
    const blocks = parseMarkdown(markdown, defaultHeadingLevel);
    const types = blocks.map((block) => block.type);
    expect(types).toEqual([
      "heading",
      "paragraph",
      "list",
      "list",
      "table",
      "code",
      "blockquote",
      "thematicBreak",
      "html",
      "paragraph",
    ]);
  });

  it("gives offsets that cover exactly the block's Markdown", () => {
    const markdown = readFixture("mixed-blocks.md");
    const blocks = parseMarkdown(markdown, defaultHeadingLevel);
    const texts = blocks.map((block) => blockText(markdown, block));
    expect(texts[0]).toBe("# Every block type");
    expect(texts[2]).toBe(
      "- First item\n- Second item\n  - Nested item under the second item\n- Third item",
    );
    expect(texts[4]).toBe("| Name | Role |\n|---|---|\n| Asha | Writer |\n| Kenji | Reviewer |");
    expect(texts[5]).toBe('```ts\nconst greeting = "hello";\nconsole.log(greeting);\n```');
    expect(texts[7]).toBe("---");
    expect(texts[8]).toBe("<div>An HTML block.</div>");
  });

  it("keeps a nested list inside its top-level list block", () => {
    const markdown = readFixture("mixed-blocks.md");
    const blocks = parseMarkdown(markdown, defaultHeadingLevel);
    const listBlocks = blocks.filter((block) => block.type === "list");
    expect(listBlocks).toHaveLength(2);
  });

  it("builds heading paths and section ids", () => {
    const markdown = readFixture("nested-headings.md");
    const blocks = parseMarkdown(markdown, defaultHeadingLevel);
    const summary = blocks.map((block) => [block.type, block.headingPath, block.sectionId]);
    const chapterOne = "Chapter One";
    const sectionOne = "Section 1.1";
    const subsection = "Subsection 1.1.1";
    const detail = "Detail 1.1.1.1";
    const setup = "Setup with bun and care";
    expect(summary).toEqual([
      ["paragraph", [], 0],
      ["heading", [chapterOne], 1],
      ["paragraph", [chapterOne], 1],
      ["heading", [chapterOne, sectionOne], 2],
      ["paragraph", [chapterOne, sectionOne], 2],
      ["heading", [chapterOne, sectionOne, subsection], 3],
      ["paragraph", [chapterOne, sectionOne, subsection], 3],
      // Level 4 is deeper than the heading level, so the section does not change.
      ["heading", [chapterOne, sectionOne, subsection, detail], 3],
      ["paragraph", [chapterOne, sectionOne, subsection, detail], 3],
      ["heading", [chapterOne, setup], 4],
      ["paragraph", [chapterOne, setup], 4],
      ["heading", ["Chapter Two"], 5],
      ["paragraph", ["Chapter Two"], 5],
    ]);
  });

  it("sets the level on headings only", () => {
    const markdown = readFixture("nested-headings.md");
    const blocks = parseMarkdown(markdown, defaultHeadingLevel);
    const levels = blocks.map((block) => block.level);
    expect(levels).toEqual([
      undefined,
      1,
      undefined,
      2,
      undefined,
      3,
      undefined,
      4,
      undefined,
      2,
      undefined,
      1,
      undefined,
    ]);
  });

  it("starts new sections only at headings up to the heading level", () => {
    const markdown = readFixture("nested-headings.md");
    const blocks = parseMarkdown(markdown, 1);
    const sectionIds = blocks.map((block) => block.sectionId);
    expect(sectionIds).toEqual([0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2]);
  });

  it("parses a document of headings only", () => {
    const markdown = readFixture("headings-only.md");
    const blocks = parseMarkdown(markdown, defaultHeadingLevel);
    const summary = blocks.map((block) => [block.type, block.headingPath, block.sectionId]);
    expect(summary).toEqual([
      ["heading", ["One"], 1],
      ["heading", ["One", "Two"], 2],
      ["heading", ["One", "Two", "Three"], 3],
    ]);
  });

  it("returns no blocks for empty and whitespace-only documents", () => {
    expect(parseMarkdown(readFixture("empty.md"), defaultHeadingLevel)).toEqual([]);
    expect(parseMarkdown(readFixture("whitespace-only.md"), defaultHeadingLevel)).toEqual([]);
  });

  it("uses UTF-16 offsets for Hindi, Japanese, and emoji", () => {
    const markdown = readFixture("multilingual.md");
    const blocks = parseMarkdown(markdown, defaultHeadingLevel);
    const headingTexts = blocks
      .filter((block) => block.type === "heading")
      .map((block) => blockText(markdown, block));
    expect(headingTexts).toEqual(["# हिंदी", "# 日本語", "# Emoji 🎉"]);
    const lastBlock = blocks.at(-1);
    expect(lastBlock?.headingPath).toEqual(["Emoji 🎉"]);
    expect(lastBlock?.end).toBe(markdown.trimEnd().length);
  });

  it("returns ordered, non-overlapping blocks inside the Markdown for every fixture", () => {
    const fixtureNames = [
      "crlf-bom.md",
      "headings-only.md",
      "large-table.md",
      "long-code-block.md",
      "long-list.md",
      "long-paragraph.md",
      "mixed-blocks.md",
      "multilingual.md",
      "nested-headings.md",
    ];
    for (const fixtureName of fixtureNames) {
      const markdown = readFixture(fixtureName);
      const blocks = parseMarkdown(markdown, defaultHeadingLevel);
      expect(blocks.length).toBeGreaterThan(0);
      let previousEnd = 0;
      for (const block of blocks) {
        expect(block.start).toBeGreaterThanOrEqual(previousEnd);
        expect(block.end).toBeGreaterThan(block.start);
        expect(block.end).toBeLessThanOrEqual(markdown.length);
        previousEnd = block.end;
      }
    }
  });
});
