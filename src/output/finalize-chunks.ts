// Turns the ranges a strategy returns into finished chunks: text, ids, hashes, index, headings, and metadata.
import type { Block, DocumentIR, Range } from "../ir/ir-types";
import { canonicalOptions } from "../options/canonical-options";
import { headingPrefixText } from "../options/heading-prefix";
import type { ResolvedOptions } from "../options/resolve-options";
import type { RawChunk } from "../strategies/strategy-types";
import type { Chunk, ChunkWarning } from "../types";
import { chunkWarnings, hasSizeLimit } from "./chunk-warnings";
import { hashText } from "./hash";
/** The finished chunks and the warnings raised while building them. */
export interface FinalizedChunks {
  chunks: Chunk[];
  warnings: ChunkWarning[];
}

/** Returns the finished chunks, sorted by position. Drops ranges that are empty after trimming. */
export function finalizeChunks(
  ir: DocumentIR,
  rawChunks: RawChunk[],
  options: ResolvedOptions,
  documentId: string,
): FinalizedChunks {
  const keptChunks: KeptChunk[] = [];
  for (const [sourceIndex, rawChunk] of rawChunks.entries()) {
    const trimmedChunk = trimRawChunk(ir.markdown, rawChunk);
    if (trimmedChunk !== undefined && !isOnlyThematicBreaks(ir.blocks, trimmedChunk)) {
      keptChunks.push({ rawChunk: trimmedChunk, sourceIndex });
    }
  }
  keptChunks.sort((first, second) => compareChunks(first.rawChunk, second.rawChunk));

  const idPrefix = `${documentId}\n${canonicalOptions(options)}`;
  const isSizeLimited = hasSizeLimit(options);
  const chunks: Chunk[] = [];
  const warnings: ChunkWarning[] = [];
  const chunkBySourceIndex = new Map<number, Chunk>();
  for (const [index, kept] of keptChunks.entries()) {
    const chunk = buildChunk(ir, kept.rawChunk, index, idPrefix, options);
    chunks.push(chunk);
    chunkBySourceIndex.set(kept.sourceIndex, chunk);
    warnings.push(...chunkWarnings(chunk, kept.rawChunk, isSizeLimited));
  }
  linkParentsAndChildren(keptChunks, chunkBySourceIndex);
  return { chunks, warnings };
}

/** A raw chunk that survived trimming, with its position in the strategy's list, which parentIndex refers to. */
interface KeptChunk {
  rawChunk: RawChunk;
  sourceIndex: number;
}

/** Sets parentId on each child and adds it to its parent's childIds, in chunk order (hierarchical only). */
function linkParentsAndChildren(
  keptChunks: KeptChunk[],
  chunkBySourceIndex: Map<number, Chunk>,
): void {
  for (const kept of keptChunks) {
    const parentIndex = kept.rawChunk.parentIndex;
    if (parentIndex === undefined) {
      continue;
    }
    const child = chunkBySourceIndex.get(kept.sourceIndex);
    const parent = chunkBySourceIndex.get(parentIndex);
    if (child !== undefined && parent !== undefined) {
      child.parentId = parent.id;
      parent.childIds?.push(child.id);
    }
  }
}

/** Builds one chunk from its trimmed raw chunk. */
function buildChunk(
  ir: DocumentIR,
  rawChunk: RawChunk,
  index: number,
  idPrefix: string,
  options: ResolvedOptions,
): Chunk {
  const touchedBlocks = findTouchedBlocks(ir.blocks, rawChunk);
  const headingPath = touchedBlocks[0]?.headingPath ?? [];
  const bodyText = chunkText(ir.markdown, rawChunk);
  const text = options.headingPrefix ? headingPrefixText(headingPath) + bodyText : bodyText;
  // The level is part of the id, because a parent and its only child can cover the same range.
  const levelPart = rawChunk.level === undefined ? "" : `\n${rawChunk.level}`;
  const chunk: Chunk = {
    id: hashText(`${idPrefix}\n${rawChunk.start}\n${rawChunk.end}${levelPart}`),
    text,
    index,
    start: rawChunk.start,
    end: rawChunk.end,
    charCount: text.length,
    headingPath: [...headingPath],
    blockTypes: uniqueBlockTypes(touchedBlocks),
    contentHash: hashText(text),
    // Each chunk gets its own copy, so changing one chunk's metadata does not change the others.
    metadata: { ...options.metadata },
  };
  if (rawChunk.context !== undefined) {
    chunk.contextText = ir.markdown.slice(rawChunk.context.start, rawChunk.context.end);
  }
  if (rawChunk.level !== undefined) {
    chunk.level = rawChunk.level;
    chunk.childIds = [];
  }
  return chunk;
}

/** Returns the chunk's text: the prefix, the range's text, and the suffix, joined by newlines. */
function chunkText(markdown: string, rawChunk: RawChunk): string {
  const parts: string[] = [];
  if (rawChunk.prefix !== undefined) {
    parts.push(markdown.slice(rawChunk.prefix.start, rawChunk.prefix.end));
  }
  parts.push(markdown.slice(rawChunk.start, rawChunk.end));
  if (rawChunk.suffix !== undefined) {
    parts.push(markdown.slice(rawChunk.suffix.start, rawChunk.suffix.end));
  }
  return parts.join("\n");
}

/** Returns the raw chunk with whitespace trimmed from its range, or undefined if no text is left. */
function trimRawChunk(markdown: string, rawChunk: RawChunk): RawChunk | undefined {
  let start = rawChunk.start;
  let end = rawChunk.end;
  // A side with a prefix or suffix is not where the chunk text starts or ends, so it keeps its
  // whitespace, such as the indentation of a code line.
  if (rawChunk.prefix === undefined) {
    while (start < end && isWhitespace(markdown, start)) {
      start++;
    }
  }
  if (rawChunk.suffix === undefined) {
    while (end > start && isWhitespace(markdown, end - 1)) {
      end--;
    }
  }
  const hasText = /\S/.test(markdown.slice(start, end));
  if (!hasText) {
    return undefined;
  }
  return { ...rawChunk, start, end };
}

/** Returns true when the character at the index is whitespace. */
function isWhitespace(markdown: string, index: number): boolean {
  return /\s/.test(markdown.charAt(index));
}

/** Returns true when every block the range touches is a thematic break (---). */
function isOnlyThematicBreaks(blocks: Block[], range: Range): boolean {
  const touchedBlocks = findTouchedBlocks(blocks, range);
  if (touchedBlocks.length === 0) {
    return false;
  }
  for (const block of touchedBlocks) {
    if (block.type !== "thematicBreak") {
      return false;
    }
  }
  return true;
}

/** Returns the blocks that overlap the range, in document order. */
function findTouchedBlocks(blocks: Block[], range: Range): Block[] {
  const touchedBlocks: Block[] = [];
  let blockIndex = firstBlockEndingAfter(blocks, range.start);
  while (blockIndex < blocks.length) {
    const block = blocks[blockIndex];
    if (block === undefined || block.start >= range.end) {
      break;
    }
    touchedBlocks.push(block);
    blockIndex++;
  }
  return touchedBlocks;
}

/** Returns the index of the first block that ends after the offset, found by binary search. */
function firstBlockEndingAfter(blocks: Block[], offset: number): number {
  let low = 0;
  let high = blocks.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const middleBlock = blocks[middle];
    if (middleBlock !== undefined && middleBlock.end <= offset) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

/** Returns the block types in order, each listed once. */
function uniqueBlockTypes(blocks: Block[]): string[] {
  const types: string[] = [];
  for (const block of blocks) {
    if (!types.includes(block.type)) {
      types.push(block.type);
    }
  }
  return types;
}

/** Orders chunks by start, then by level (parents first), then by end (CLAUDE.md 2.3). */
function compareChunks(first: RawChunk, second: RawChunk): number {
  if (first.start !== second.start) {
    return first.start - second.start;
  }
  const levelDifference = (first.level ?? 0) - (second.level ?? 0);
  if (levelDifference !== 0) {
    return levelDifference;
  }
  return first.end - second.end;
}
