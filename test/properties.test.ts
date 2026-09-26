// Property-based tests (PRD 11, item 2): invariants every strategy must keep, checked on generated documents.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type Chunk,
  type ChunkOptions,
  type ChunkResult,
  chunkDocument,
  DocchunkError,
} from "../src/index";
import { parseMarkdown } from "../src/ir/parse-markdown";
import { headingPrefixText } from "../src/options/heading-prefix";

const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

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

/** Generates structure options, keeping minSize <= size and overlapChars < size. */
const structureOptionsArbitrary = fc.integer({ min: 1, max: 400 }).chain((size) =>
  fc.record({
    strategy: fc.constant("structure" as const),
    size: fc.constant(size),
    minSize: fc.integer({ min: 1, max: size }),
    overlapChars: fc.integer({ min: 0, max: size - 1 }),
    headingLevel: fc.integer({ min: 1, max: 6 }),
  }),
);

/** Generates the options sentence and paragraph share: an optional size, with minSize and overlapChars inside it. */
function packingOptionsArbitrary<Name extends "sentence" | "paragraph">(strategy: Name) {
  return fc.option(fc.integer({ min: 1, max: 400 }), { nil: undefined }).chain((size) =>
    fc.record({
      strategy: fc.constant(strategy),
      size: fc.constant(size),
      minSize: fc.integer({ min: 1, max: size ?? 400 }),
      overlapChars: fc.integer({ min: 0, max: (size ?? 401) - 1 }),
    }),
  );
}

/** Generates heading options: an optional size and a heading level. */
const headingOptionsArbitrary = fc.record({
  strategy: fc.constant("heading" as const),
  size: fc.option(fc.integer({ min: 1, max: 400 }), { nil: undefined }),
  headingLevel: fc.integer({ min: 1, max: 6 }),
});

/** Checks 0 <= start < end <= markdown length for every chunk. */
function checkRanges(result: ChunkResult): void {
  for (const chunk of result.chunks) {
    expect(chunk.start).toBeGreaterThanOrEqual(0);
    expect(chunk.end).toBeGreaterThan(chunk.start);
    expect(chunk.end).toBeLessThanOrEqual(result.document.markdown.length);
  }
}

/** Returns the chunk text without its heading prefix, checking the prefix is the expected one. */
function bodyText(chunk: Chunk, hasHeadingPrefix: boolean): string {
  if (!hasHeadingPrefix) {
    return chunk.text;
  }
  const prefix = headingPrefixText(chunk.headingPath);
  expect(chunk.text.startsWith(prefix)).toBe(true);
  return chunk.text.slice(prefix.length);
}

/** Checks every chunk is at most size characters. A single grapheme larger than size is allowed (DECISIONS 9). */
function checkSize(result: ChunkResult, size: number, hasHeadingPrefix = false): void {
  for (const chunk of result.chunks) {
    const body = bodyText(chunk, hasHeadingPrefix);
    const graphemeCount = [...graphemeSegmenter.segment(body)].length;
    if (graphemeCount !== 1) {
      expect(chunk.charCount).toBeLessThanOrEqual(size);
    }
  }
}

/** Checks each chunk's text is its slice of the Markdown, except heading prefixes and split table or code pieces (PRD 7.4). */
function checkTextSlice(result: ChunkResult, hasHeadingPrefix: boolean): void {
  for (const chunk of result.chunks) {
    const slice = result.document.markdown.slice(chunk.start, chunk.end);
    const body = bodyText(chunk, hasHeadingPrefix);
    const isSplitPiece = chunk.blockTypes.includes("table") || chunk.blockTypes.includes("code");
    if (isSplitPiece && body !== slice) {
      // A split piece has a repeated header or fence around its slice.
      expect(body).toContain(slice);
    } else {
      expect(body).toBe(slice);
    }
    expect(chunk.charCount).toBe(chunk.text.length);
  }
}

/** Checks that no chunk touches blocks from two different sections. */
function checkSections(result: ChunkResult, headingLevel: number): void {
  if (result.document.sourceFormat !== "markdown") {
    return;
  }
  const blocks = parseMarkdown(result.document.markdown, headingLevel);
  for (const chunk of result.chunks) {
    const sectionIds = new Set<number>();
    for (const block of blocks) {
      if (block.start < chunk.end && block.end > chunk.start) {
        sectionIds.add(block.sectionId);
      }
    }
    expect(sectionIds.size).toBeLessThanOrEqual(1);
  }
}

/** Checks chunk indexes are 0, 1, 2, ... in order. */
function checkIndexes(result: ChunkResult): void {
  for (const [position, chunk] of result.chunks.entries()) {
    expect(chunk.index).toBe(position);
  }
}

/** Checks every non-whitespace character is in a chunk, except thematic breaks and, if asked, headings. */
function checkCoverage(result: ChunkResult, shouldIgnoreHeadings: boolean): void {
  const markdown = result.document.markdown;
  const isCovered = new Array<boolean>(markdown.length).fill(false);
  for (const chunk of result.chunks) {
    isCovered.fill(true, chunk.start, chunk.end);
  }
  if (result.document.sourceFormat === "markdown") {
    for (const block of parseMarkdown(markdown, 3)) {
      const isIgnored =
        block.type === "thematicBreak" || (shouldIgnoreHeadings && block.type === "heading");
      if (isIgnored) {
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

/** Runs the checks that apply to every strategy. The sentence strategies leave headings out by design. */
async function checkCommonProperties(
  source: { content: string; format: "markdown" | "text" },
  options: ChunkOptions,
  shouldIgnoreHeadings = false,
): Promise<ChunkResult> {
  const result = await chunkDocument(source, options);
  checkRanges(result);
  checkTextSlice(result, options.headingPrefix === true);
  checkIndexes(result);
  checkCoverage(result, shouldIgnoreHeadings);
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

describe("structure strategy properties", () => {
  it("keeps every invariant on generated documents and never crosses a section", async () => {
    await fc.assert(
      fc.asyncProperty(sourceArbitrary, structureOptionsArbitrary, async (source, options) => {
        const result = await checkCommonProperties(source, options);
        checkSize(result, options.size);
        checkSections(result, options.headingLevel);
      }),
    );
  });
});

describe("sentence strategy properties", () => {
  it("keeps every invariant on generated documents, with and without a size", async () => {
    await fc.assert(
      fc.asyncProperty(
        sourceArbitrary,
        packingOptionsArbitrary("sentence"),
        async (source, options) => {
          const result = await checkCommonProperties(source, options, true);
          if (options.size !== undefined) {
            checkSize(result, options.size);
          }
          checkSections(result, 3);
        },
      ),
    );
  });
});

describe("paragraph strategy properties", () => {
  it("keeps every invariant on generated documents, with and without a size", async () => {
    await fc.assert(
      fc.asyncProperty(
        sourceArbitrary,
        packingOptionsArbitrary("paragraph"),
        async (source, options) => {
          const result = await checkCommonProperties(source, options);
          if (options.size !== undefined) {
            checkSize(result, options.size);
          }
          checkSections(result, 3);
        },
      ),
    );
  });
});

describe("heading strategy properties", () => {
  it("keeps every invariant on generated documents, with and without a size", async () => {
    await fc.assert(
      fc.asyncProperty(sourceArbitrary, headingOptionsArbitrary, async (source, options) => {
        const result = await checkCommonProperties(source, options);
        if (options.size !== undefined) {
          checkSize(result, options.size);
        }
        checkSections(result, options.headingLevel);
      }),
    );
  });
});

/** Generates options for several strategies, all with headingPrefix on. */
const prefixedOptionsArbitrary = fc
  .oneof(
    structureOptionsArbitrary,
    fixedOptionsArbitrary,
    recursiveOptionsArbitrary,
    headingOptionsArbitrary,
    packingOptionsArbitrary("sentence"),
  )
  .map((options) => ({ ...options, headingPrefix: true }));

/** Returns false when headingPrefix leaves no room within size, which is a valid INVALID_OPTIONS error. */
async function leavesRoomForPrefix(
  source: { content: string; format: "markdown" | "text" },
  options: ChunkOptions,
): Promise<boolean> {
  try {
    await chunkDocument(source, options);
    return true;
  } catch (error) {
    const isNoRoomError =
      error instanceof DocchunkError && error.message.startsWith('Option "headingPrefix"');
    if (isNoRoomError) {
      return false;
    }
    throw error;
  }
}

describe("headingPrefix properties", () => {
  it("keeps every invariant, with the prefix counted toward size", async () => {
    await fc.assert(
      fc.asyncProperty(sourceArbitrary, prefixedOptionsArbitrary, async (source, options) => {
        fc.pre(await leavesRoomForPrefix(source, options));
        const isSentence = options.strategy === "sentence";
        const result = await checkCommonProperties(source, options, isSentence);
        if (options.size !== undefined) {
          checkSize(result, options.size, true);
        }
      }),
    );
  });
});
