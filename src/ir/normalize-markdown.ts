// Normalizes document text before parsing: one kind of line ending and no byte order mark.

const byteOrderMark = "﻿";

/** Returns the text with CRLF and lone CR line endings turned into LF, and a leading BOM removed. */
export function normalizeMarkdown(text: string): string {
  const withoutBom = text.startsWith(byteOrderMark) ? text.slice(byteOrderMark.length) : text;
  return withoutBom.replace(/\r\n?/g, "\n");
}
