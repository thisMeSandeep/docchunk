// Checks the sentence-window strategy: one chunk per unit, context of windowSize units per side, and sections.
import { describe, expect, it } from "vitest";
import { chunkDocument } from "../../src/index";
import { sentenceWindowStrategy } from "../../src/strategies/sentence-window";

/** Chunks Markdown with sentence-window and returns each chunk's text and contextText. */
async function windowPairs(
  content: string,
  windowSize?: number,
): Promise<[string, string | undefined][]> {
  const options =
    windowSize === undefined
      ? { strategy: "sentence-window" as const }
      : { strategy: "sentence-window" as const, windowSize };
  const result = await chunkDocument({ content, format: "markdown" }, options);
  return result.chunks.map((chunk) => [chunk.text, chunk.contextText]);
}

describe("sentence-window strategy", () => {
  it("makes one chunk per sentence with windowSize sentences of context on each side", async () => {
    expect(await windowPairs("S1. S2. S3. S4. S5.", 1)).toEqual([
      ["S1.", "S1. S2."],
      ["S2.", "S1. S2. S3."],
      ["S3.", "S2. S3. S4."],
      ["S4.", "S3. S4. S5."],
      ["S5.", "S4. S5."],
    ]);
  });

  it("uses 3 units on each side by default", async () => {
    const pairs = await windowPairs("S1. S2. S3. S4. S5. S6. S7. S8.");
    expect(pairs[4]).toEqual(["S5.", "S2. S3. S4. S5. S6. S7. S8."]);
    expect(sentenceWindowStrategy.defaults).toEqual({ windowSize: 3 });
  });

  it("keeps the context inside the chunk's section", async () => {
    const content = "# A\n\nA1. A2.\n\n# B\n\nB1. B2.";
    expect(await windowPairs(content, 3)).toEqual([
      ["A1.", "A1. A2."],
      ["A2.", "A1. A2."],
      ["B1.", "B1. B2."],
      ["B2.", "B1. B2."],
    ]);
  });

  it("gives a context equal to the text when windowSize is 0", async () => {
    for (const [text, contextText] of await windowPairs("One. Two.", 0)) {
      expect(contextText).toBe(text);
    }
  });

  it("treats a table as one unit in the window", async () => {
    const content = "Before.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nAfter.";
    const pairs = await windowPairs(content, 1);
    expect(pairs[1]).toEqual(["| a | b |\n|---|---|\n| 1 | 2 |", content]);
  });

  it("takes contextText as an exact slice of the Markdown", async () => {
    const content = "First line of a\nwrapped sentence. Second. Third.";
    const result = await chunkDocument(
      { content, format: "markdown" },
      { strategy: "sentence-window", windowSize: 1 },
    );
    expect(result.chunks[0]?.contextText).toBe("First line of a\nwrapped sentence. Second.");
  });

  it("rejects a windowSize that is negative or not an integer", () => {
    for (const windowSize of [-1, 1.5]) {
      const validate = () => sentenceWindowStrategy.validate({ windowSize });
      expect(validate).toThrow('Option "windowSize" must be an integer of 0 or more');
    }
  });
});
