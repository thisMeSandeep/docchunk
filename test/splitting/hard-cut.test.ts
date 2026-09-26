// Checks hardCut and groupParts: pieces within size, and graphemes such as emoji and Hindi letters kept whole.
import { describe, expect, it } from "vitest";
import type { Range } from "../../src/ir/ir-types";
import { groupParts } from "../../src/splitting/group-parts";
import { hardCut } from "../../src/splitting/hard-cut";

/** Hard-cuts the whole text and returns the text of each piece. */
function cutTexts(text: string, size: number): string[] {
  const pieces: Range[] = hardCut(text, { start: 0, end: text.length }, size);
  return pieces.map((piece) => text.slice(piece.start, piece.end));
}

describe("hardCut", () => {
  it("cuts plain text at exactly size", () => {
    expect(cutTexts("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("never splits an emoji made of several code points", () => {
    const family = "👨‍👩‍👧‍👦";
    expect(cutTexts(`ab${family}cd`, 13)).toEqual([`ab${family}`, "cd"]);
    expect(cutTexts(`ab${family}cd`, 5)).toEqual(["ab", family, "cd"]);
  });

  it("gives a grapheme larger than size its own piece", () => {
    expect(cutTexts("👋🏽x", 2)).toEqual(["👋🏽", "x"]);
  });

  it("keeps Hindi letters with their vowel signs", () => {
    const pieces = cutTexts("नमस्ते", 2);
    expect(pieces.join("")).toBe("नमस्ते");
    for (const piece of pieces) {
      expect(piece.length).toBeLessThanOrEqual(4);
    }
    expect(pieces).not.toContain("्");
  });

  it("returns no pieces for an empty range", () => {
    expect(cutTexts("", 5)).toEqual([]);
  });
});

describe("groupParts", () => {
  it("groups consecutive parts up to the budget", () => {
    const parts = [
      { start: 0, end: 3 },
      { start: 4, end: 7 },
      { start: 8, end: 11 },
    ];
    expect(groupParts(parts, 7)).toEqual([
      { start: 0, end: 7, isOversized: false },
      { start: 8, end: 11, isOversized: false },
    ]);
  });

  it("puts a part larger than the budget in its own oversized group", () => {
    const parts = [
      { start: 0, end: 2 },
      { start: 3, end: 20 },
      { start: 21, end: 23 },
    ];
    expect(groupParts(parts, 5)).toEqual([
      { start: 0, end: 2, isOversized: false },
      { start: 3, end: 20, isOversized: true },
      { start: 21, end: 23, isOversized: false },
    ]);
  });
});
