// Checks splitList: whole items grouped within size, nested lists kept with their item, and items too large.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeMarkdown } from "../../src/ir/normalize-markdown";
import { splitList } from "../../src/splitting/split-list";
import { firstBlockOfType, pieceText } from "./piece-text";

describe("splitList", () => {
  const markdown = normalizeMarkdown(readFileSync("test/fixtures/markdown/long-list.md", "utf8"));
  const list = firstBlockOfType(markdown, "list");
  const pieces = splitList(markdown, list, 500);

  it("keeps every piece within size and starts each at an item", () => {
    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) {
      const text = pieceText(markdown, piece);
      expect(text.length).toBeLessThanOrEqual(500);
      expect(text.startsWith("- Item ")).toBe(true);
    }
  });

  it("covers the whole list with no gaps", () => {
    expect(pieces[0]?.start).toBe(list.start);
    expect(pieces.at(-1)?.end).toBe(list.end);
    for (let index = 1; index < pieces.length; index++) {
      const between = markdown.slice(pieces[index - 1]?.end, pieces[index]?.start);
      expect(between.trim()).toBe("");
    }
  });

  it("keeps a nested list inside its item's piece", () => {
    const pieceWithItem5 = pieces.find((piece) => pieceText(markdown, piece).includes("Item 5:"));
    const text = pieceText(markdown, pieceWithItem5 ?? { start: 0, end: 0 });
    expect(text).toContain("  - Another nested detail under item 5");
  });

  it("hard-cuts an item too large for size and marks its pieces as oversized", () => {
    const longItem = `- ${"word ".repeat(40)}`;
    const small = `- one\n${longItem}\n- two`;
    const smallPieces = splitList(small, firstBlockOfType(small, "list"), 50);
    const oversized = smallPieces.filter((piece) => piece.isOversized === true);
    expect(oversized.length).toBeGreaterThan(1);
    for (const piece of smallPieces) {
      expect(pieceText(small, piece).length).toBeLessThanOrEqual(50);
    }
  });
});
