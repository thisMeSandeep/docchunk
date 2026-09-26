// Checks that measure counts characters between two offsets.
import { describe, expect, it } from "vitest";
import { measure } from "../../src/output/measure";

describe("measure", () => {
  it("returns the number of characters in a range", () => {
    expect(measure(0, 1500)).toBe(1500);
    expect(measure(200, 350)).toBe(150);
  });

  it("returns 0 for an empty range", () => {
    expect(measure(42, 42)).toBe(0);
  });

  it("matches the length of the sliced text", () => {
    const markdown = "# Title\n\nनमस्ते दुनिया 👋 こんにちは";
    const start = 9;
    const end = markdown.length;
    expect(measure(start, end)).toBe(markdown.slice(start, end).length);
  });
});
