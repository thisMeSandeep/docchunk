// Test support: builds a piece's full text the way finalize-chunks will, and parses a Markdown string.
import type { Block } from "../../src/ir/ir-types";
import { parseMarkdown } from "../../src/ir/parse-markdown";
import type { RawChunk } from "../../src/strategies/strategy-types";

/** Returns the piece's text: prefix, the sliced range, and suffix, joined by newlines. */
export function pieceText(markdown: string, piece: RawChunk): string {
  const parts: string[] = [];
  if (piece.prefix !== undefined) {
    parts.push(markdown.slice(piece.prefix.start, piece.prefix.end));
  }
  parts.push(markdown.slice(piece.start, piece.end));
  if (piece.suffix !== undefined) {
    parts.push(markdown.slice(piece.suffix.start, piece.suffix.end));
  }
  return parts.join("\n");
}

/** Returns the first block of the given type in the Markdown. Fails the test if there is none. */
export function firstBlockOfType(markdown: string, type: Block["type"]): Block {
  const block = parseMarkdown(markdown, 3).find((candidate) => candidate.type === type);
  if (block === undefined) {
    throw new Error(`No ${type} block found`);
  }
  return block;
}
