// Checks mergeSmallChunks and addOverlap on hand-built chunks.
import { describe, expect, it } from "vitest";
import type { Unit } from "../../src/ir/ir-types";
import { addOverlap } from "../../src/splitting/add-overlap";
import { mergeSmallChunks } from "../../src/splitting/merge-small-chunks";

describe("mergeSmallChunks", () => {
  it("merges a small chunk into the previous one when the result fits", () => {
    const chunks = [
      { start: 0, end: 50, sectionId: 1 },
      { start: 52, end: 60, sectionId: 1 },
    ];
    expect(mergeSmallChunks(chunks, 20, 100)).toEqual([{ start: 0, end: 60, sectionId: 1 }]);
  });

  it("merges into the next chunk when the previous one is too full", () => {
    const chunks = [
      { start: 0, end: 95, sectionId: 1 },
      { start: 97, end: 105, sectionId: 1 },
      { start: 107, end: 150, sectionId: 1 },
    ];
    expect(mergeSmallChunks(chunks, 20, 100)).toEqual([
      { start: 0, end: 95, sectionId: 1 },
      { start: 97, end: 150, sectionId: 1 },
    ]);
  });

  it("leaves a small chunk alone when neither neighbor fits", () => {
    const chunks = [
      { start: 0, end: 95, sectionId: 1 },
      { start: 97, end: 105, sectionId: 1 },
      { start: 107, end: 200, sectionId: 1 },
    ];
    expect(mergeSmallChunks(chunks, 20, 100)).toEqual(chunks);
  });

  it("never merges across sections", () => {
    const chunks = [
      { start: 0, end: 10, sectionId: 1 },
      { start: 12, end: 20, sectionId: 2 },
    ];
    expect(mergeSmallChunks(chunks, 50, 100)).toEqual(chunks);
  });

  it("does not merge when a suffix or prefix would land in the middle", () => {
    const fence = { start: 200, end: 203 };
    const withSuffix = [
      { start: 0, end: 10, sectionId: 1, suffix: fence },
      { start: 12, end: 20, sectionId: 1 },
    ];
    expect(mergeSmallChunks(withSuffix, 50, 100)).toEqual(withSuffix);
    const withPrefix = [
      { start: 0, end: 10, sectionId: 1 },
      { start: 12, end: 20, sectionId: 1, prefix: fence },
    ];
    expect(mergeSmallChunks(withPrefix, 50, 100)).toEqual(withPrefix);
  });

  it("keeps the first chunk's prefix, the second chunk's suffix, and the oversized flag", () => {
    const prefix = { start: 300, end: 305 };
    const suffix = { start: 400, end: 403 };
    const chunks = [
      { start: 0, end: 10, sectionId: 1, prefix },
      { start: 12, end: 20, sectionId: 1, suffix, isOversized: true },
    ];
    expect(mergeSmallChunks(chunks, 50, 100)).toEqual([
      { start: 0, end: 20, sectionId: 1, prefix, suffix, isOversized: true },
    ]);
  });

  it("counts the prefix and suffix toward size", () => {
    const prefix = { start: 300, end: 390 };
    const chunks = [
      { start: 0, end: 5, sectionId: 1, prefix },
      { start: 7, end: 12, sectionId: 1 },
    ];
    expect(mergeSmallChunks(chunks, 50, 100)).toEqual(chunks);
  });
});

describe("addOverlap", () => {
  const units: Unit[] = [
    { start: 0, end: 10, blockIndex: 0, kind: "sentence" },
    { start: 11, end: 20, blockIndex: 0, kind: "sentence" },
    { start: 21, end: 30, blockIndex: 0, kind: "sentence" },
    { start: 31, end: 40, blockIndex: 0, kind: "sentence" },
  ];
  const chunks = [
    { start: 0, end: 20, sectionId: 1 },
    { start: 21, end: 40, sectionId: 1 },
  ];

  it("changes nothing when overlapChars is 0", () => {
    expect(addOverlap(chunks, units, 0, 100)).toBe(chunks);
  });

  it("moves the start back over whole units of the previous chunk", () => {
    expect(addOverlap(chunks, units, 9, 100)[1]).toEqual({ start: 11, end: 40, sectionId: 1 });
    expect(addOverlap(chunks, units, 20, 100)[1]).toEqual({ start: 0, end: 40, sectionId: 1 });
  });

  it("uses no unit that does not fit in overlapChars", () => {
    expect(addOverlap(chunks, units, 8, 100)[1]).toEqual(chunks[1]);
  });

  it("stops before the chunk would exceed size", () => {
    expect(addOverlap(chunks, units, 20, 30)[1]).toEqual({ start: 11, end: 40, sectionId: 1 });
  });

  it("does not overlap across sections or before a prefix", () => {
    const otherSection = [chunks[0], { start: 21, end: 40, sectionId: 2 }];
    expect(addOverlap(otherSection, units, 20, 100)).toEqual(otherSection);
    const withPrefix = [
      chunks[0],
      { start: 21, end: 40, sectionId: 1, prefix: { start: 0, end: 3 } },
    ];
    expect(addOverlap(withPrefix, units, 20, 100)).toEqual(withPrefix);
  });
});
