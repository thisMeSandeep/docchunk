// Checks list item, table row, table header, and code line parts produced by parseMarkdown.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Block, Range } from "../../src/ir/ir-types";
import { normalizeMarkdown } from "../../src/ir/normalize-markdown";
import { parseMarkdown } from "../../src/ir/parse-markdown";

const defaultHeadingLevel = 3;

/** Reads a Markdown fixture and normalizes it. */
function readFixture(name: string): string {
  const raw = readFileSync(`test/fixtures/markdown/${name}`, "utf8");
  return normalizeMarkdown(raw);
}

/** Returns the first block of the given type. Fails the test if there is none. */
function firstBlockOfType(markdown: string, type: Block["type"]): Block {
  const blocks = parseMarkdown(markdown, defaultHeadingLevel);
  const block = blocks.find((candidate) => candidate.type === type);
  if (block === undefined) {
    throw new Error(`No ${type} block found`);
  }
  return block;
}

/** Returns the Markdown text of each range. */
function rangeTexts(markdown: string, ranges: Range[] | undefined): string[] {
  const texts: string[] = [];
  for (const range of ranges ?? []) {
    texts.push(markdown.slice(range.start, range.end));
  }
  return texts;
}

describe("list parts", () => {
  it("has one part per top-level item, with nested lists inside their item", () => {
    const markdown = readFixture("mixed-blocks.md");
    const list = firstBlockOfType(markdown, "list");
    expect(rangeTexts(markdown, list.parts)).toEqual([
      "- First item",
      "- Second item\n  - Nested item under the second item",
      "- Third item",
    ]);
  });

  it("finds every item of a long list", () => {
    const markdown = readFixture("long-list.md");
    const list = firstBlockOfType(markdown, "list");
    const itemTexts = rangeTexts(markdown, list.parts);
    expect(itemTexts).toHaveLength(70);
    expect(itemTexts[4]).toContain("  - Another nested detail under item 5");
  });
});

describe("table parts", () => {
  it("has a header part with the delimiter row, and one part per body row", () => {
    const markdown = readFixture("mixed-blocks.md");
    const table = firstBlockOfType(markdown, "table");
    const headerTexts = rangeTexts(markdown, table.headerPart ? [table.headerPart] : []);
    expect(headerTexts).toEqual(["| Name | Role |\n|---|---|"]);
    expect(rangeTexts(markdown, table.parts)).toEqual([
      "| Asha | Writer |",
      "| Kenji | Reviewer |",
    ]);
  });

  it("finds every row of a large table", () => {
    const markdown = readFixture("large-table.md");
    const table = firstBlockOfType(markdown, "table");
    const rowTexts = rangeTexts(markdown, table.parts);
    expect(rowTexts).toHaveLength(60);
    expect(rowTexts[0]).toBe("| 1 | Task 1 | Description of task number 1 | closed |");
  });

  it("includes trailing spaces of the header row in the header part", () => {
    const markdown = "| A | B |  \n|---|---|\n| 1 | 2 |";
    const table = firstBlockOfType(markdown, "table");
    const headerTexts = rangeTexts(markdown, table.headerPart ? [table.headerPart] : []);
    expect(headerTexts).toEqual(["| A | B |  \n|---|---|"]);
  });
});

describe("code parts", () => {
  it("has one part per line, without the fence lines", () => {
    const markdown = readFixture("mixed-blocks.md");
    const code = firstBlockOfType(markdown, "code");
    expect(rangeTexts(markdown, code.parts)).toEqual([
      'const greeting = "hello";',
      "console.log(greeting);",
    ]);
  });

  it("finds every line of a long code block", () => {
    const markdown = readFixture("long-code-block.md");
    const code = firstBlockOfType(markdown, "code");
    expect(rangeTexts(markdown, code.parts)).toHaveLength(90);
  });

  it("keeps empty lines inside the code", () => {
    const markdown = "```\nfirst\n\nthird\n```";
    const code = firstBlockOfType(markdown, "code");
    expect(rangeTexts(markdown, code.parts)).toEqual(["first", "", "third"]);
  });

  it("handles tilde fences", () => {
    const markdown = "~~~python\nprint(1)\n~~~";
    const code = firstBlockOfType(markdown, "code");
    expect(rangeTexts(markdown, code.parts)).toEqual(["print(1)"]);
  });

  it("keeps the last line of an unclosed fence", () => {
    const markdown = "```\nline one\nline two";
    const code = firstBlockOfType(markdown, "code");
    expect(rangeTexts(markdown, code.parts)).toEqual(["line one", "line two"]);
  });

  it("returns no parts for an empty fenced block", () => {
    const markdown = "```\n```";
    const code = firstBlockOfType(markdown, "code");
    expect(code.parts).toEqual([]);
  });

  it("uses every line of an indented code block", () => {
    const markdown = "    line one\n    line two";
    const code = firstBlockOfType(markdown, "code");
    expect(rangeTexts(markdown, code.parts)).toEqual(["    line one", "    line two"]);
  });
});

describe("parts of other blocks", () => {
  it("leaves parts and headerPart unset on other block types", () => {
    const markdown = readFixture("mixed-blocks.md");
    const blocks = parseMarkdown(markdown, defaultHeadingLevel);
    for (const block of blocks) {
      const hasParts = block.type === "list" || block.type === "table" || block.type === "code";
      if (!hasParts) {
        expect(block.parts).toBeUndefined();
      }
      if (block.type !== "table") {
        expect(block.headerPart).toBeUndefined();
      }
    }
  });

  it("keeps every part inside its block, in order", () => {
    const fixtureNames = [
      "mixed-blocks.md",
      "large-table.md",
      "long-code-block.md",
      "long-list.md",
    ];
    for (const fixtureName of fixtureNames) {
      const markdown = readFixture(fixtureName);
      for (const block of parseMarkdown(markdown, defaultHeadingLevel)) {
        let previousEnd = block.start;
        for (const part of block.parts ?? []) {
          expect(part.start).toBeGreaterThanOrEqual(previousEnd);
          expect(part.end).toBeLessThanOrEqual(block.end);
          previousEnd = part.end;
        }
      }
    }
  });
});
