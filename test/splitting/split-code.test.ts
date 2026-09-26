// Checks splitCode: line groups within size, every piece wrapped in the original fence, and edge cases.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeMarkdown } from "../../src/ir/normalize-markdown";
import { splitCode } from "../../src/splitting/split-code";
import { firstBlockOfType, pieceText } from "./piece-text";

describe("splitCode", () => {
  const markdown = normalizeMarkdown(
    readFileSync("test/fixtures/markdown/long-code-block.md", "utf8"),
  );
  const code = firstBlockOfType(markdown, "code");
  const pieces = splitCode(markdown, code, 500);

  it("keeps every piece within size, counting the fence lines", () => {
    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) {
      expect(pieceText(markdown, piece).length).toBeLessThanOrEqual(500);
    }
  });

  it("wraps every piece in the original fence", () => {
    for (const piece of pieces) {
      const text = pieceText(markdown, piece);
      expect(text.startsWith("```ts\n")).toBe(true);
      expect(text.endsWith("\n```")).toBe(true);
    }
  });

  it("puts every line of code in exactly one piece", () => {
    const codeLines: string[] = [];
    for (const piece of pieces) {
      const lines = markdown.slice(piece.start, piece.end).split("\n");
      codeLines.push(...lines.filter((line) => line.startsWith("const ")));
    }
    expect(codeLines).toHaveLength(90);
  });
});

describe("splitCode edge cases", () => {
  it("does not add fences to indented code", () => {
    const markdown = `${"    line of code\n".repeat(10)}`.trimEnd();
    const pieces = splitCode(markdown, firstBlockOfType(markdown, "code"), 50);
    for (const piece of pieces) {
      expect(piece.prefix).toBeUndefined();
      expect(piece.suffix).toBeUndefined();
      expect(pieceText(markdown, piece).length).toBeLessThanOrEqual(50);
    }
  });

  it("adds no closing fence to an unclosed code block", () => {
    const markdown = `\`\`\`\n${"line\n".repeat(20)}`;
    const pieces = splitCode(markdown, firstBlockOfType(markdown, "code"), 30);
    for (const piece of pieces) {
      expect(piece.suffix).toBeUndefined();
      expect(pieceText(markdown, piece).startsWith("```\n")).toBe(true);
    }
  });

  it("gives the fences their own pieces when the only line is too large", () => {
    const markdown = `\`\`\`\n${"x".repeat(100)}\n\`\`\``;
    const pieces = splitCode(markdown, firstBlockOfType(markdown, "code"), 40);
    const texts = pieces.map((piece) => pieceText(markdown, piece));
    expect(texts[0]).toBe("```");
    expect(texts.at(-1)).toBe("```");
    const middle = pieces.slice(1, -1);
    expect(middle.every((piece) => piece.isOversized === true)).toBe(true);
  });
});
