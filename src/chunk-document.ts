// chunkDocument: turns one document into chunks.
import { DocchunkError } from "./errors";
import type { DocumentIR } from "./ir/ir-types";
import { normalizeMarkdown } from "./ir/normalize-markdown";
import { parseMarkdown } from "./ir/parse-markdown";
import { parseText } from "./ir/parse-text";
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
  ContentSource,
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
  const contentSource = readContentSource(source);
  const markdown = normalizeMarkdown(contentSource.content);
  const ir = buildIR(markdown, contentSource.format, headingLevelFor(resolvedOptions));
  const documentId = resolvedOptions.documentId ?? hashText(markdown);

  const warnings: ChunkWarning[] = [];
  let chunks: Chunk[] = [];
  if (markdown.trim() === "") {
    warnings.push({ code: "EMPTY_DOCUMENT", message: "The document has no text to chunk." });
  } else {
    const rawChunks = splitDocument(ir, resolvedOptions);
    const finalized = finalizeChunks(ir, rawChunks, resolvedOptions, documentId);
    chunks = finalized.chunks;
    warnings.push(...finalized.warnings);
  }

  const durationMs = performance.now() - startedAt;
  return {
    chunks,
    document: {
      id: documentId,
      markdown,
      sourceFormat: contentSource.format,
      charCount: markdown.length,
    },
    stats: buildStats(chunks, durationMs),
    warnings,
  };
}

/** Returns the source as Markdown or text content. Throws for sources this phase cannot read yet. */
function readContentSource(source: unknown): ContentSource {
  if (typeof source !== "object" || source === null) {
    throw new DocchunkError(
      "INVALID_OPTIONS",
      "The source must be an object such as { content, format }.",
    );
  }
  const isFileSource = "path" in source || "bytes" in source;
  if (isFileSource) {
    throw new DocchunkError(
      "UNSUPPORTED_FORMAT",
      'Reading files and bytes is not supported yet. Pass { content, format: "markdown" | "text" }.',
    );
  }
  const content = "content" in source ? source.content : undefined;
  const format = "format" in source ? source.format : undefined;
  if (typeof content !== "string") {
    throw new DocchunkError("INVALID_OPTIONS", "The source's content must be a string.");
  }
  if (format !== "markdown" && format !== "text") {
    throw new DocchunkError(
      "UNSUPPORTED_FORMAT",
      'The source\'s format must be "markdown" or "text".',
    );
  }
  return { content, format };
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
  return strategy.split(ir, options.strategyOptions);
}
