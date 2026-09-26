// Detects a document's format from an explicit format or its file extension (PRD 7.2, steps 1 and 2).
import { extname } from "node:path";
import { DocchunkError } from "../errors";
import type { DocumentFormat } from "../types";

// A record, not an array, so TypeScript reports a format that is added to DocumentFormat but not here.
const knownFormats: Record<DocumentFormat, true> = {
  pdf: true,
  docx: true,
  doc: true,
  pptx: true,
  ppt: true,
  xlsx: true,
  xls: true,
  odt: true,
  ods: true,
  odp: true,
  rtf: true,
  epub: true,
  csv: true,
  markdown: true,
  text: true,
};

/** Extensions that decide the format on their own. Other formats are detected from the content (step 3). */
const formatByExtension = new Map<string, DocumentFormat>([
  [".md", "markdown"],
  [".markdown", "markdown"],
  [".txt", "text"],
  // CSV has no content signature, so its extension is the only way to know it.
  [".csv", "csv"],
]);

/** Returns the explicit format, else the format of a .md, .markdown, .txt, or .csv file name, else undefined. */
export function detectFormatFromName(
  explicitFormat: unknown,
  fileName: string | undefined,
): DocumentFormat | undefined {
  if (explicitFormat !== undefined) {
    return checkedFormat(explicitFormat);
  }
  if (fileName === undefined) {
    return undefined;
  }
  const extension = extname(fileName).toLowerCase();
  return formatByExtension.get(extension);
}

/** Returns the value as a format. Throws UNSUPPORTED_FORMAT if it is not one docchunk can read. */
export function checkedFormat(value: unknown): DocumentFormat {
  if (!isDocumentFormat(value)) {
    const formatList = Object.keys(knownFormats).join(", ");
    throw new DocchunkError(
      "UNSUPPORTED_FORMAT",
      `Format ${JSON.stringify(value)} is not supported. Supported formats: ${formatList}.`,
    );
  }
  return value;
}

/** Returns true when the value is a format docchunk can read. */
function isDocumentFormat(value: unknown): value is DocumentFormat {
  return typeof value === "string" && Object.hasOwn(knownFormats, value);
}
