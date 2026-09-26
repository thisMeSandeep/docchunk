// Checks splitTable: row groups within size, the header repeated on every piece, and rows too large for size.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeMarkdown } from "../../src/ir/normalize-markdown";
import { splitTable } from "../../src/splitting/split-table";
import { firstBlockOfType, pieceText } from "./piece-text";

const header = "| ID | Name | Description | Status |\n|---|---|---|---|";

describe("splitTable", () => {
  const markdown = normalizeMarkdown(readFileSync("test/fixtures/markdown/large-table.md", "utf8"));
  const table = firstBlockOfType(markdown, "table");
  const pieces = splitTable(markdown, table, 500);

  it("keeps every piece within size, counting the repeated header", () => {
    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) {
      expect(pieceText(markdown, piece).length).toBeLessThanOrEqual(500);
    }
  });

  it("starts every piece with the header and delimiter rows", () => {
    for (const piece of pieces) {
      expect(pieceText(markdown, piece).startsWith(`${header}\n| `)).toBe(true);
    }
  });

  it("takes the first piece's header from the table itself and adds it to the others", () => {
    expect(pieces[0]?.start).toBe(table.start);
    expect(pieces[0]?.prefix).toBeUndefined();
    for (const piece of pieces.slice(1)) {
      expect(piece.prefix).toEqual(table.headerPart);
    }
  });

  it("puts every row in exactly one piece, in order", () => {
    const rowTexts: string[] = [];
    for (const piece of pieces) {
      const bodyLines = markdown.slice(piece.start, piece.end).split("\n");
      rowTexts.push(...bodyLines.filter((line) => /^\| \d+ \|/.test(line)));
    }
    expect(rowTexts).toHaveLength(60);
    expect(rowTexts[0]).toContain("Task 1 ");
    expect(rowTexts[59]).toContain("Task 60 ");
  });
});

describe("splitTable with rows too large for size", () => {
  it("hard-cuts a large row and marks its pieces as oversized", () => {
    const longRow = `| ${"x".repeat(150)} | y |`;
    const markdown = `| A | B |\n|---|---|\n| short | row |\n${longRow}\n| last | row |`;
    const pieces = splitTable(markdown, firstBlockOfType(markdown, "table"), 60);
    const texts = pieces.map((piece) => pieceText(markdown, piece));
    expect(texts[0]).toBe("| A | B |\n|---|---|\n| short | row |");
    expect(texts.at(-1)).toBe("| A | B |\n|---|---|\n| last | row |");
    const oversized = pieces.filter((piece) => piece.isOversized === true);
    expect(oversized.length).toBeGreaterThan(1);
    for (const text of texts) {
      expect(text.length).toBeLessThanOrEqual(60);
    }
  });

  it("gives the header its own piece when the first row is too large", () => {
    const markdown = `| A | B |\n|---|---|\n| ${"x".repeat(100)} |\n| last | row |`;
    const pieces = splitTable(markdown, firstBlockOfType(markdown, "table"), 40);
    expect(pieceText(markdown, pieces[0] ?? { start: 0, end: 0 })).toBe("| A | B |\n|---|---|");
  });

  it("does not repeat a header that is too large to fit with a row", () => {
    const markdown = "| Alpha | Beta |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |";
    const pieces = splitTable(markdown, firstBlockOfType(markdown, "table"), 20);
    for (const piece of pieces) {
      expect(piece.prefix).toBeUndefined();
      expect(pieceText(markdown, piece).length).toBeLessThanOrEqual(20);
    }
  });
});
