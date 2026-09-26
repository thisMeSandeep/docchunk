// Property-based tests (PRD 11, item 2): invariants every strategy must keep, checked on generated documents.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type ChunkOptions, type ChunkResult, chunkDocument } from "../src/index";
import { parseMarkdown } from "../src/ir/parse-markdown";

/** Pieces of Markdown that generated documents are built from, including Hindi, Japanese, and emoji. */
const markdownLines = [
  "# Heading one",
  "## Heading two",
  "#### Deep heading",
  "A plain sentence. Another sentence follows it.",
  "Words without any punctuation at all",
  "- list item",
  "1. ordered item",
  "| a | b |",
  "|---|---|",
  "| 1 | 2 |",
  "```",
  "const value = 1;",
  "> quoted line",
  "---",
  "<div>html</div>",
  "भारत एक विशाल देश है। यहाँ कई भाषाएँ हैं।",
  "東京は日本の首都です。人口は多いです。",
  "Families 👨‍👩‍👧‍👦 and flags 🇮🇳 😀",
  "",
  "   ",
];

/** Generates a document made of known Markdown lines mixed with random text. */
const documentArbitrary = fc
  .array(
    fc.oneof(
      { weight: 4, arbitrary: fc.constantFrom(...markdownLines) },
      { weight: 1, arbitrary: fc.string({ unit: "grapheme", maxLength: 40 }) },
    ),
    { maxLength: 40 },
  )
  .map((lines) => lines.join("\n"));

/** Generates a source: the same generated text read as Markdown or as plain text. */
const sourceArbitrary = fc.record({
  content: documentArbitrary,
  format: fc.constantFrom("markdown" as const, "text" as const),
});

/** Generates fixed strategy options. */
const fixedOptionsArbitrary = fc.record({
  strategy: fc.constant("fixed" as const),
  size: fc.integer({ min: 1, max: 400 }),
  boundary: fc.constantFrom("word" as const, "char" as const),
});

/** Generates fixed-overlap options, with overlapChars always smaller than size. */
const fixedOverlapOptionsArbitrary = fc.integer({ min: 1, max: 400 }).chain((size) =>
  fc.record({
    strategy: fc.constant("fixed-overlap" as const),
    size: fc.constant(size),
    overlapChars: fc.integer({ min: 0, max: size - 1 }),
    boundary: fc.constantFrom("word" as const, "char" as const),
  }),
);

/** Generates sliding-window options, with step always at most size. */
const slidingWindowOptionsArbitrary = fc.integer({ min: 1, max: 400 }).chain((size) =>
  fc.record({
    strategy: fc.constant("sliding-window" as const),
    size: fc.constant(size),
    step: fc.integer({ min: 1, max: size }),
    boundary: fc.constantFrom("word" as const, "char" as const),
  }),
);

/** Generates recursive options: the default separators or a custom list, with overlapChars below size. */
const recursiveOptionsArbitrary = fc.integer({ min: 1, max: 400 }).chain((size) =>
  fc.record({
    strategy: fc.constant("recursive" as const),
    size: fc.constant(size),
    overlapChars: fc.integer({ min: 0, max: size - 1 }),
    separators: fc.option(
      fc.constantFrom(["\n"], ["\n\n", "."], ["|", "\n#"]).map((list) => [...list]),
      { nil: undefined },
    ),
  }),
);

/** Checks 0 <= start < end <= markdown length for every chunk. */
function checkRanges(result: ChunkResult): void {
  for (const chunk of result.chunks) {
    expect(chunk.start).toBeGreaterThanOrEqual(0);
    expect(chunk.end).toBeGreaterThan(chunk.start);
    expect(chunk.end).toBeLessThanOrEqual(result.document.markdown.length);
  }
}

/** Checks every chunk is at most size characters. A single character larger than size is allowed (DECISIONS 9). */
function checkSize(result: ChunkResult, size: number): void {
  for (const chunk of result.chunks) {
    const isSingleCharacter = [...chunk.text].length === 1;
    if (!isSingleCharacter) {
      expect(chunk.charCount).toBeLessThanOrEqual(size);
    }
  }
}

/** Checks each chunk's text is its slice of the Markdown and charCount is its length. */
function checkTextSlice(result: ChunkResult): void {
  for (const chunk of result.chunks) {
    expect(chunk.text).toBe(result.document.markdown.slice(chunk.start, chunk.end));
    expect(chunk.charCount).toBe(chunk.text.length);
  }
}

/** Checks chunk indexes are 0, 1, 2, ... in order. */
function checkIndexes(result: ChunkResult): void {
  for (const [position, chunk] of result.chunks.entries()) {
    expect(chunk.index).toBe(position);
  }
}

/** Checks every non-whitespace character outside thematic breaks is inside at least one chunk. */
function checkCoverage(result: ChunkResult): void {
  const markdown = result.document.markdown;
  const isCovered = new Array<boolean>(markdown.length).fill(false);
  for (const chunk of result.chunks) {
    isCovered.fill(true, chunk.start, chunk.end);
  }
  if (result.document.sourceFormat === "markdown") {
    for (const block of parseMarkdown(markdown, 3)) {
      if (block.type === "thematicBreak") {
        isCovered.fill(true, block.start, block.end);
      }
    }
  }
  for (let index = 0; index < markdown.length; index++) {
    const isWhitespace = /\s/.test(markdown.charAt(index));
    if (!isWhitespace && !isCovered[index]) {
      expect.fail(`Character ${index} (${JSON.stringify(markdown.charAt(index))}) is in no chunk`);
    }
  }
}

/** Returns the result without the duration, which is the one field allowed to differ between runs. */
function withoutDuration(result: ChunkResult): unknown {
  return { ...result, stats: { ...result.stats, durationMs: 0 } };
}

/** Runs the checks that apply to every strategy. */
async function checkCommonProperties(
  source: { content: string; format: "markdown" | "text" },
  options: ChunkOptions,
): Promise<ChunkResult> {
  const result = await chunkDocument(source, options);
  checkRanges(result);
  checkTextSlice(result);
  checkIndexes(result);
  checkCoverage(result);
  const secondRun = await chunkDocument(source, options);
  expect(withoutDuration(secondRun)).toEqual(withoutDuration(result));
  return result;
}

describe("fixed strategy properties", () => {
  it("keeps every invariant on generated documents", async () => {
    await fc.assert(
      fc.asyncProperty(sourceArbitrary, fixedOptionsArbitrary, async (source, options) => {
        const result = await checkCommonProperties(source, options);
        checkSize(result, options.size);
      }),
    );
  });
});

describe("fixed-overlap strategy properties", () => {
  it("keeps every invariant on generated documents", async () => {
    await fc.assert(
      fc.asyncProperty(sourceArbitrary, fixedOverlapOptionsArbitrary, async (source, options) => {
        const result = await checkCommonProperties(source, options);
        checkSize(result, options.size);
      }),
    );
  });
});

describe("sliding-window strategy properties", () => {
  it("keeps every invariant on generated documents", async () => {
    await fc.assert(
      fc.asyncProperty(sourceArbitrary, slidingWindowOptionsArbitrary, async (source, options) => {
        const result = await checkCommonProperties(source, options);
        checkSize(result, options.size);
      }),
    );
  });
});

describe("recursive strategy properties", () => {
  it("keeps every invariant on generated documents", async () => {
    await fc.assert(
      fc.asyncProperty(sourceArbitrary, recursiveOptionsArbitrary, async (source, options) => {
        const result = await checkCommonProperties(source, options);
        checkSize(result, options.size);
      }),
    );
  });
});
