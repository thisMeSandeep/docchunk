// Turns any document source into text to parse: content as given, Markdown or text bytes decoded, other formats converted.
import type { ChunkWarning, DocumentFormat } from "../types";
import { convertWithAnydoc } from "./convert-with-anydoc";
import { detectFormatFromName } from "./detect-format";
import { readSource } from "./read-source";

/** A document ready to parse, with where it came from. */
export interface LoadedDocument {
  /** The Markdown or plain text, before normalization. */
  text: string;
  /** How to parse the text: plain text is split on blank lines, everything else is Markdown. */
  parseAs: "markdown" | "text";
  sourceFormat: DocumentFormat;
  /** The file path, when the source was a path. */
  sourcePath: string | undefined;
  /** NO_TEXT_LAYER when a PDF has no usable text. */
  warnings: ChunkWarning[];
}

// A UTF-8 decoder removes a leading byte order mark; invalid bytes become U+FFFD instead of throwing.
const utf8Decoder = new TextDecoder("utf-8");

/** Returns the document's text, reading the file and converting it with anydoc when needed. */
export async function loadDocument(source: unknown): Promise<LoadedDocument> {
  const loaded = await readSource(source);
  if (loaded.kind === "content") {
    return {
      text: loaded.content,
      parseAs: loaded.format,
      sourceFormat: loaded.format,
      sourcePath: undefined,
      warnings: [],
    };
  }
  const knownFormat = detectFormatFromName(loaded.format, loaded.fileName);
  if (knownFormat === "markdown" || knownFormat === "text") {
    // Markdown and text need no conversion, so anydoc is never loaded for them.
    return {
      text: utf8Decoder.decode(loaded.bytes),
      parseAs: knownFormat,
      sourceFormat: knownFormat,
      sourcePath: loaded.path,
      warnings: [],
    };
  }
  const conversion = await convertWithAnydoc(loaded.bytes, knownFormat, loaded.fileName);
  return {
    text: conversion.markdown,
    parseAs: "markdown",
    sourceFormat: conversion.sourceFormat,
    sourcePath: loaded.path,
    warnings: conversion.warnings,
  };
}
