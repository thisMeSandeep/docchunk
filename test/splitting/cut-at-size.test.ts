// Checks cutAtSize: piece sizes, word boundaries, and emoji that must not be cut in half.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Range } from "../../src/ir/ir-types";
import { cutAtSize } from "../../src/splitting/cut-at-size";

/** Returns the text of each piece. */
function pieceTexts(text: string, pieces: Range[]): string[] {
  const texts: string[] = [];
  for (const piece of pieces) {
    texts.push(text.slice(piece.start, piece.end));
  }
  return texts;
}

/** Cuts the whole text and returns the text of each piece. */
function cutWhole(text: string, size: number, boundary: "word" | "char"): string[] {
  const pieces = cutAtSize(text, { start: 0, end: text.length }, size, boundary);
  return pieceTexts(text, pieces);
}

describe("cutAtSize with char boundary", () => {
  it("cuts at exactly size characters", () => {
    expect(cutWhole("abcdefghij", 3, "char")).toEqual(["abc", "def", "ghi", "j"]);
  });

  it("cuts inside words", () => {
    expect(cutWhole("hello world", 4, "char")).toEqual(["hell", "o wo", "rld"]);
  });

  it("cuts only the given range", () => {
    const text = "0123456789";
    const pieces = cutAtSize(text, { start: 2, end: 8 }, 4, "char");
    expect(pieces).toEqual([
      { start: 2, end: 6 },
      { start: 6, end: 8 },
    ]);
  });

  it("returns no pieces for an empty range", () => {
    expect(cutAtSize("abc", { start: 1, end: 1 }, 5, "char")).toEqual([]);
  });
});

describe("cutAtSize with word boundary", () => {
  it("moves a cut inside a word back to whitespace in the last 10%", () => {
    const text = `${"a".repeat(18)} bbbbbb`;
    expect(cutWhole(text, 20, "word")).toEqual([`${"a".repeat(18)} `, "bbbbbb"]);
  });

  it("cuts at size when the last 10% has no whitespace", () => {
    const text = `${"a".repeat(10)} ${"b".repeat(20)}`;
    expect(cutWhole(text, 20, "word")).toEqual([
      `${"a".repeat(10)} ${"b".repeat(9)}`,
      "b".repeat(11),
    ]);
  });

  it("keeps a cut that already falls between words", () => {
    const text = `${"a".repeat(20)} bbb`;
    expect(cutWhole(text, 20, "word")).toEqual(["a".repeat(20), " bbb"]);
  });

  it("keeps every piece within size on a long paragraph", () => {
    const text = readFileSync("test/fixtures/markdown/long-paragraph.md", "utf8");
    const pieces = cutAtSize(text, { start: 0, end: text.length }, 500, "word");
    let previousEnd = 0;
    for (const piece of pieces) {
      expect(piece.start).toBe(previousEnd);
      expect(piece.end - piece.start).toBeLessThanOrEqual(500);
      previousEnd = piece.end;
    }
    expect(previousEnd).toBe(text.length);
  });
});

describe("cutAtSize with emoji", () => {
  it("never cuts between the two halves of an emoji", () => {
    expect(cutWhole("ab😀cd", 3, "char")).toEqual(["ab", "😀c", "d"]);
  });

  it("keeps an emoji whole even when size is 1", () => {
    expect(cutWhole("😀x", 1, "char")).toEqual(["😀", "x"]);
  });
});

describe("cutAtSize with overlap", () => {
  /** Cuts the whole text with overlap and returns the text of each piece. */
  function cutWithOverlap(text: string, size: number, overlapChars: number): string[] {
    const pieces = cutAtSize(text, { start: 0, end: text.length }, size, "char", overlapChars);
    return pieceTexts(text, pieces);
  }

  it("repeats overlapChars characters at the start of each next piece", () => {
    expect(cutWithOverlap("abcdefghij", 4, 2)).toEqual(["abcd", "cdef", "efgh", "ghij"]);
  });

  it("stops once a piece reaches the end, without an extra piece inside the last one", () => {
    expect(cutWithOverlap("abcdef", 4, 2)).toEqual(["abcd", "cdef"]);
  });

  it("still moves forward when a word cut makes a piece shorter than the overlap", () => {
    const text = `${"a".repeat(8)} bbbbbbbbbb`;
    const pieces = cutAtSize(text, { start: 0, end: text.length }, 10, "word", 9);
    let previousStart = -1;
    for (const piece of pieces) {
      expect(piece.start).toBeGreaterThan(previousStart);
      previousStart = piece.start;
    }
    expect(pieces.at(-1)?.end).toBe(text.length);
  });

  it("never starts a piece between the two halves of an emoji", () => {
    const text = "ab😀cdef";
    const pieces = cutAtSize(text, { start: 0, end: text.length }, 4, "char", 2);
    for (const piece of pieces) {
      const firstUnit = text.charCodeAt(piece.start);
      const isLowSurrogate = firstUnit >= 0xdc00 && firstUnit <= 0xdfff;
      expect(isLowSurrogate).toBe(false);
    }
  });
});
