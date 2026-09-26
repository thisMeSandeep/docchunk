// chunkDocument: turns one document into chunks.
import { loadDocument } from "./input/load-document";
import type { DocumentIR } from "./ir/ir-types";
import { normalizeMarkdown } from "./ir/normalize-markdown";
import { parseMarkdown } from "./ir/parse-markdown";
import { parseText } from "./ir/parse-text";
import { reserveHeadingPrefixSpace } from "./options/heading-prefix";
import { type ResolvedOptions, resolveOptions } from "./options/resolve-options";
import { buildStats } from "./output/build-stats";
import { finalizeChunks } from "./output/finalize-chunks";
import { hashText } from "./output/hash";
import { strategyRegistry } from "./strategies/registry";
import type { RawChunk } from "./strategies/strategy-types";
import type {
  Chunk,
  ChunkOptions,
  ChunkResult,
  ChunkWarning,
  DocumentInfo,
  DocumentSource,
  StrategyName,
} from "./types";

/** Heading level used to number sections when the strategy has no headingLevel option. */
const defaultHeadingLevel = 3;

/** Converts one document to Markdown (if needed) and splits it into chunks. */
export async function chunkDocument(
  source: DocumentSource,
  options?: ChunkOptions,
): Promise<ChunkResult> {
  const startedAt = performance.now();
  const resolvedOptions = resolveOptions(options);
  const loaded = await loadDocument(source);
  const markdown = normalizeMarkdown(loaded.text);
  const ir = buildIR(markdown, loaded.parseAs, headingLevelFor(resolvedOptions));
  const documentId = resolvedOptions.documentId ?? hashText(markdown);

  const warnings: ChunkWarning[] = [...loaded.warnings];
  const hasNoTextLayer = warnings.some((warning) => warning.code === "NO_TEXT_LAYER");
  let chunks: Chunk[] = [];
  // A PDF without a text layer gives no chunks (PRD 7.6); NO_TEXT_LAYER already explains why.
  if (hasNoTextLayer) {
    chunks = [];
  } else if (markdown.trim() === "") {
    warnings.push({ code: "EMPTY_DOCUMENT", message: "The document has no text to chunk." });
  } else {
    const rawChunks = splitDocument(ir, resolvedOptions);
    const finalized = finalizeChunks(ir, rawChunks, resolvedOptions, documentId);
    chunks = finalized.chunks;
    warnings.push(...finalized.warnings);
  }

  const document: DocumentInfo = {
    id: documentId,
    markdown,
    sourceFormat: loaded.sourceFormat,
    charCount: markdown.length,
  };
  if (loaded.sourcePath !== undefined) {
    document.sourcePath = loaded.sourcePath;
  }
  const durationMs = performance.now() - startedAt;
  return { chunks, document, stats: buildStats(chunks, durationMs), warnings };
}

/** Parses the normalized document into the IR that every strategy reads. */
function buildIR(markdown: string, format: "markdown" | "text", headingLevel: number): DocumentIR {
  // Plain text is not parsed as Markdown, so characters like # or * are not read as formatting.
  const blocks = format === "text" ? parseText(markdown) : parseMarkdown(markdown, headingLevel);
  return { markdown, blocks };
}

/** Returns the strategy's headingLevel option, or the default for strategies without one. */
function headingLevelFor(options: ResolvedOptions): number {
  const strategyOptions = options.strategyOptions;
  if ("headingLevel" in strategyOptions && typeof strategyOptions.headingLevel === "number") {
    return strategyOptions.headingLevel;
  }
  return defaultHeadingLevel;
}

/** Runs the chosen strategy and returns its ranges. */
function splitDocument<Name extends StrategyName>(
  ir: DocumentIR,
  options: ResolvedOptions<Name>,
): RawChunk[] {
  const strategy = strategyRegistry[options.strategy];
  // The chunk ids still use the caller's options; only the split sees the reduced size.
  const splitOptions = reserveHeadingPrefixSpace(options, ir.blocks);
  return strategy.split(ir, splitOptions);
}
