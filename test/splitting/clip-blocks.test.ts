// Checks clipBlocks: blocks cut to a range, with parts cut the same way and headers kept in place.
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../../src/ir/parse-markdown";
import { clipBlocks } from "../../src/splitting/clip-blocks";

const markdown = "Intro paragraph.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n\nOutro.";
const blocks = parseMarkdown(markdown, 3);
const table = blocks[1];

describe("clipBlocks", () => {
  it("returns blocks fully inside the range unchanged", () => {
    expect(clipBlocks(blocks, { start: 0, end: markdown.length })).toEqual(blocks);
  });

  it("leaves out blocks outside the range", () => {
    const clipped = clipBlocks(blocks, { start: 0, end: 16 });
    expect(clipped.map((block) => block.type)).toEqual(["paragraph"]);
  });

  it("cuts a table to the range, keeps rows inside it, and keeps the header's position", () => {
    const secondRowStart = markdown.indexOf("| 3 | 4 |");
    const clipped = clipBlocks(blocks, { start: secondRowStart, end: markdown.length });
    const clippedTable = clipped[0];
    expect(clippedTable?.type).toBe("table");
    expect(clippedTable?.start).toBe(secondRowStart);
    expect(clippedTable?.parts).toEqual([{ start: secondRowStart, end: secondRowStart + 9 }]);
    expect(clippedTable?.headerPart).toEqual(table?.headerPart);
  });

  it("cuts a part that crosses the range edge", () => {
    const firstRowStart = markdown.indexOf("| 1 | 2 |");
    const clipped = clipBlocks(blocks, { start: firstRowStart + 2, end: firstRowStart + 6 });
    expect(clipped[0]?.parts).toEqual([{ start: firstRowStart + 2, end: firstRowStart + 6 }]);
  });
});
