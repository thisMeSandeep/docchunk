// Every default and limit docchunk uses, in one place. Change a value here to change it everywhere.
import { noSizeLimit } from "./options/option-checks";
import type { ResolvedStrategyOptions } from "./strategies/strategy-types";
import type { StrategyName } from "./types";

// Strategies

/** The strategy used when the caller does not name one (PRD 6.1). */
export const defaultStrategy: StrategyName = "structure";

/** Default options for every strategy (PRD 6.1). The type makes a strategy without defaults a compile error. */
export const strategyDefaults: ResolvedStrategyOptions = {
  structure: { size: 1500, minSize: 200, overlapChars: 0, headingLevel: 3 },
  sentence: { size: noSizeLimit, minSize: 1, overlapChars: 0 },
  paragraph: { size: noSizeLimit, minSize: 1, overlapChars: 0 },
  heading: { size: noSizeLimit, headingLevel: 3 },
  "sentence-window": { windowSize: 3 },
  "parent-child": { parentSize: 4000, childSize: 800 },
  hierarchical: { by: "size", levels: [6000, 1500, 400], headingLevel: 3, leafSize: 1500 },
  fixed: { size: 1500, boundary: "word" },
  "fixed-overlap": { size: 1500, overlapChars: 200, boundary: "word" },
  recursive: {
    size: 1500,
    overlapChars: 0,
    separators: ["\n# ", "\n## ", "\n### ", "\n#### ", "\n\n", "\n"],
  },
  "sliding-window": { size: 1500, step: 750, boundary: "word" },
};

/** Heading level that starts a section for strategies without a headingLevel option. */
export const defaultHeadingLevel = 3;

/** minSize used for each level's structure run in hierarchical, unless the level's size is smaller. */
export const hierarchicalLevelMinSize = 200;

/** Share of a chunk, at its end, searched for a space when cutting at a word boundary (PRD 6.2). */
export const wordBoundarySearchShare = 0.1;

// Batches

/** Documents chunkDocuments chunks at the same time when the caller does not set `concurrency`. */
export const defaultConcurrency = 4;

// Warnings

/** Chunks larger than this get a LARGE_CHUNK warning when the strategy has no size limit (PRD 6.4). */
export const largeChunkChars = 8000;

/** A PDF with fewer non-whitespace characters than this gets a NO_TEXT_LAYER warning (PRD 7.6). */
export const minimumPdfTextChars = 100;

// Ids and text

/** Hex characters kept from each SHA-256 hash for ids and content hashes (PRD 7.5). Changing it changes every id. */
export const hashLength = 20;

/** Locale for sentence and grapheme boundaries. Fixed so boundaries, and so chunks and ids, are the same on every machine. */
export const segmenterLocale = "en";
