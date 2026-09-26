// Converts office documents and PDFs to Markdown with anydoc, which is loaded only when first needed.
// A type-only import is erased at build time, so it does not load anydoc.
import type { Format } from "@firecrawl/anydoc";
import { DocchunkError } from "../errors";
import type { ChunkWarning, DocumentFormat } from "../types";
import { checkedFormat } from "./detect-format";

type Anydoc = typeof import("@firecrawl/anydoc");

/** A PDF with fewer non-whitespace characters than this is treated as scanned (PRD 7.6). */
const minimumPdfTextChars = 100;

/** The first bytes of an OLE file: the container of old Office formats such as .xls. */
const oleSignature = [0xd0, 0xcf, 0x11, 0xe0];

/** The result of converting one document: its Markdown, its format, and any warnings. */
export interface Conversion {
  markdown: string;
  sourceFormat: DocumentFormat;
  warnings: ChunkWarning[];
}

// Loaded on first use, so documents that need no conversion never load anydoc's native binary.
let anydocModule: Promise<Anydoc> | undefined;

/** Returns Markdown for the bytes. Detects the format from the content when it is not given (PRD 7.2, steps 3 and 4). */
export async function convertWithAnydoc(
  bytes: Uint8Array,
  knownFormat: DocumentFormat | undefined,
  fileName: string | undefined,
): Promise<Conversion> {
  const anydoc = await loadAnydoc();
  const anydocFormat = findAnydocFormat(anydoc, bytes, knownFormat, fileName);
  const sourceFormat = knownFormat ?? toDocumentFormat(anydocFormat, bytes);
  const documentName = fileName ?? "the document";
  let markdown: string;
  try {
    // No options are passed: the default rejects scanned pages instead of sending them to a hosted OCR service.
    markdown = await anydoc.toMarkdownBytes(bytes, anydocFormat);
  } catch (error) {
    return handleConversionError(error, sourceFormat, documentName);
  }
  const warnings: ChunkWarning[] = [];
  if (sourceFormat === "pdf" && countNonWhitespace(markdown) < minimumPdfTextChars) {
    warnings.push({
      code: "NO_TEXT_LAYER",
      message: "This PDF appears to be scanned; OCR is not supported.",
    });
  }
  return { markdown, sourceFormat, warnings };
}

/** Returns anydoc's module, importing it on the first call. */
function loadAnydoc(): Promise<Anydoc> {
  anydocModule ??= import("@firecrawl/anydoc").catch((error: unknown) => {
    anydocModule = undefined;
    throw new DocchunkError(
      "CONVERSION_FAILED",
      "The anydoc converter could not be loaded. Its native binary may be missing for this platform.",
      { cause: error },
    );
  });
  return anydocModule;
}

/** Returns anydoc's name for the format: from the known format, else the content, else the file extension. */
function findAnydocFormat(
  anydoc: Anydoc,
  bytes: Uint8Array,
  knownFormat: DocumentFormat | undefined,
  fileName: string | undefined,
): Format {
  // anydoc's Format is a const enum, so its values come from anydoc's own functions, never from string casts.
  const fromKnownFormat =
    knownFormat === undefined ? null : anydoc.formatFromExtension(knownFormat);
  const fromContent = anydoc.formatFromBytes(bytes);
  const fromExtension = fileName === undefined ? null : anydoc.formatFromPath(fileName);
  const format = fromKnownFormat ?? fromContent ?? fromExtension;
  if (format === null) {
    throw new DocchunkError(
      "UNSUPPORTED_FORMAT",
      "The document's format could not be detected from its content or file name. Pass `format` to name it.",
    );
  }
  return format;
}

/** Returns docchunk's name for a format anydoc reports. anydoc reads .xls with its .xlsx parser, so .xls is told apart by its file signature. */
function toDocumentFormat(anydocFormat: string, bytes: Uint8Array): DocumentFormat {
  if (anydocFormat === "xlsx" && startsWith(bytes, oleSignature)) {
    return "xls";
  }
  return checkedFormat(anydocFormat);
}

/** Turns a rejected conversion into a NO_TEXT_LAYER warning for scanned pages, or a DocchunkError otherwise. */
function handleConversionError(
  error: unknown,
  sourceFormat: DocumentFormat,
  documentName: string,
): Conversion {
  const code: unknown = error instanceof Error ? Reflect.get(error, "code") : undefined;
  if (code === "needsOcr") {
    const warning: ChunkWarning = { code: "NO_TEXT_LAYER", message: scannedPagesMessage(error) };
    return { markdown: "", sourceFormat, warnings: [warning] };
  }
  const detail = error instanceof Error ? error.message : String(error);
  const errorCode = code === "unsupported" ? "UNSUPPORTED_FORMAT" : "CONVERSION_FAILED";
  throw new DocchunkError(
    errorCode,
    `Could not convert ${documentName}: ${detail} (${String(code)})`,
    {
      cause: error,
    },
  );
}

/** Returns the NO_TEXT_LAYER message, naming the pages anydoc reports as scanned. */
function scannedPagesMessage(error: unknown): string {
  const pages: unknown = error instanceof Error ? Reflect.get(error, "pages") : undefined;
  const pageCount: unknown = error instanceof Error ? Reflect.get(error, "pageCount") : undefined;
  const base = "This PDF appears to be scanned; OCR is not supported.";
  if (!Array.isArray(pages) || typeof pageCount !== "number") {
    return base;
  }
  return `${base} Pages without a text layer: ${pages.join(", ")} of ${pageCount}.`;
}

/** Returns the number of characters that are not whitespace. */
function countNonWhitespace(text: string): number {
  return text.replace(/\s/g, "").length;
}

/** Returns true when the bytes begin with the signature. */
function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  for (const [index, expected] of signature.entries()) {
    if (bytes[index] !== expected) {
      return false;
    }
  }
  return true;
}
