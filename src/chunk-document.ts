// chunkDocument: turns one document into chunks.
import { checkAborted } from "./check-aborted";
import { defaultHeadingLevel } from "./config";
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

/** Converts one document to Markdown (if needed) and splits it into chunks. */
export async function chunkDocument(
  source: DocumentSource,
  options?: ChunkOptions,
): Promise<ChunkResult> {
  const resolvedOptions = resolveOptions(options);
  return chunkWithResolvedOptions(source, resolvedOptions);
}

/** Chunks one document with options that were already checked. chunkDocuments uses it to check options once per batch. */
export async function chunkWithResolvedOptions(
  source: unknown,
  resolvedOptions: ResolvedOptions,
): Promise<ChunkResult> {
  const startedAt = performance.now();
  const signal = resolvedOptions.signal;
  checkAborted(signal);
  const loaded = await loadDocument(source);
  // Reading and converting cannot be stopped halfway, so the signal is checked again once they finish.
  checkAborted(signal);
  const markdown = normalizeMarkdown(loaded.text);
  const ir = buildIR(markdown, loaded.parseAs, headingLevelFor(resolvedOptions));
  const documentId = resolvedOptions.documentId ?? hashText(markdown);
  const { chunks, warnings } = splitIntoChunks(ir, loaded.warnings, resolvedOptions, documentId);

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

/** Returns the chunks and all warnings. A PDF without a text layer or an empty document gives no chunks. */
function splitIntoChunks(
  ir: DocumentIR,
  loadWarnings: ChunkWarning[],
  resolvedOptions: ResolvedOptions,
  documentId: string,
): { chunks: Chunk[]; warnings: ChunkWarning[] } {
  const warnings: ChunkWarning[] = [...loadWarnings];
  // NO_TEXT_LAYER already explains why there are no chunks (PRD 7.6), so EMPTY_DOCUMENT is not added.
  const hasNoTextLayer = warnings.some((warning) => warning.code === "NO_TEXT_LAYER");
  if (hasNoTextLayer) {
    return { chunks: [], warnings };
  }
  if (ir.markdown.trim() === "") {
    warnings.push({ code: "EMPTY_DOCUMENT", message: "The document has no text to chunk." });
    return { chunks: [], warnings };
  }
  const rawChunks = splitDocument(ir, resolvedOptions);
  checkAborted(resolvedOptions.signal);
  const finalized = finalizeChunks(ir, rawChunks, resolvedOptions, documentId);
  warnings.push(...finalized.warnings);
  return { chunks: finalized.chunks, warnings };
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
  return strategy.split(ir, splitOptions, options.signal);
}
