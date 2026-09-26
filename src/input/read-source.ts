// Reads a document source: a file path, bytes already in memory, or Markdown or text content.
import { readFile } from "node:fs/promises";
import { DocchunkError } from "../errors";
import type { ContentSource } from "../types";

/** A source after reading: Markdown or text ready to parse, or file bytes whose format may still be unknown. */
export type LoadedSource =
  | { kind: "content"; content: string; format: "markdown" | "text" }
  | {
      kind: "bytes";
      bytes: Uint8Array;
      /** File name used to detect the format from its extension. */
      fileName: string | undefined;
      /** The format the caller gave, not checked yet. */
      format: unknown;
      /** The path the bytes were read from, when the source was a path. */
      path: string | undefined;
    };

/** Returns the source's content or bytes. Throws INVALID_OPTIONS for a malformed source, FILE_NOT_FOUND for a missing file. */
export async function readSource(source: unknown): Promise<LoadedSource> {
  if (typeof source !== "object" || source === null) {
    throw new DocchunkError(
      "INVALID_OPTIONS",
      "The source must be an object: { path }, { bytes }, or { content, format }.",
    );
  }
  if ("path" in source) {
    const path = source.path;
    if (typeof path !== "string" || path === "") {
      throw new DocchunkError("INVALID_OPTIONS", "The source's path must be a non-empty string.");
    }
    const bytes = await readFileBytes(path);
    return { kind: "bytes", bytes, fileName: path, format: undefined, path };
  }
  if ("bytes" in source) {
    return readBytesSource(source);
  }
  const contentSource = readContentSource(source);
  return { kind: "content", content: contentSource.content, format: contentSource.format };
}

/** Returns a { bytes, filename?, format? } source. Throws INVALID_OPTIONS if bytes or filename have the wrong type. */
function readBytesSource(source: { bytes: unknown }): LoadedSource {
  if (!(source.bytes instanceof Uint8Array)) {
    throw new DocchunkError("INVALID_OPTIONS", "The source's bytes must be a Uint8Array.");
  }
  const fileName = "filename" in source ? source.filename : undefined;
  if (fileName !== undefined && typeof fileName !== "string") {
    throw new DocchunkError("INVALID_OPTIONS", "The source's filename must be a string.");
  }
  const format = "format" in source ? source.format : undefined;
  return { kind: "bytes", bytes: source.bytes, fileName, format, path: undefined };
}

/** Returns a { content, format } source. Throws if content is not a string or format is not markdown or text. */
export function readContentSource(source: object): ContentSource {
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

/** Returns the file's bytes. Throws FILE_NOT_FOUND when the file is missing, is a folder, or cannot be read. */
async function readFileBytes(path: string): Promise<Uint8Array> {
  try {
    return await readFile(path);
  } catch (error) {
    const code = error instanceof Error ? Reflect.get(error, "code") : undefined;
    const reason = describeReadError(code);
    throw new DocchunkError("FILE_NOT_FOUND", `${reason}: ${path}`, { cause: error });
  }
}

/** Returns a short reason for a file system error code. */
function describeReadError(code: unknown): string {
  if (code === "ENOENT" || code === "ENOTDIR") {
    return "File not found";
  }
  if (code === "EISDIR") {
    return "Path is a folder, not a file";
  }
  return `File could not be read (${String(code)})`;
}
