// Finds the parts of list, table, and code blocks, which the oversize cascade splits along.
import type { Code, List, Table } from "mdast";
import type { Range } from "./ir-types";
import { nodeRange } from "./node-range";

/** Matches a line that opens or closes a fenced code block: up to 3 spaces, then ``` or ~~~. */
const fenceLinePattern = /^ {0,3}(`{3,}|~{3,})/;

/** Returns one range per top-level list item, from its marker to the end of its content. */
export function listItemParts(list: List): Range[] {
  const parts: Range[] = [];
  for (const listItem of list.children) {
    parts.push(nodeRange(listItem));
  }
  return parts;
}

/** Returns the header row plus delimiter row of a table. */
export function tableHeaderPart(table: Table, markdown: string): Range {
  const tableRange = nodeRange(table);
  const headerLineEnd = lineEnd(markdown, tableRange.start, tableRange.end);
  // The delimiter row (|---|) is not a node, so it is found as the line after the header.
  const delimiterLineEnd = lineEnd(markdown, headerLineEnd + 1, tableRange.end);
  return { start: tableRange.start, end: delimiterLineEnd };
}

/** Returns one range per body row of a table. The header row is not included. */
export function tableRowParts(table: Table): Range[] {
  const parts: Range[] = [];
  const bodyRows = table.children.slice(1);
  for (const row of bodyRows) {
    parts.push(nodeRange(row));
  }
  return parts;
}

/** Returns one range per line of code, without the opening and closing fence lines. */
export function codeLineParts(code: Code, markdown: string): Range[] {
  const codeRange = nodeRange(code);
  const lines = lineRanges(markdown, codeRange.start, codeRange.end);
  const firstLine = lines[0];
  if (firstLine === undefined || !isFenceLine(markdown, firstLine)) {
    return lines;
  }
  const linesAfterOpeningFence = lines.slice(1);
  const lastLine = linesAfterOpeningFence.at(-1);
  // An unclosed fence runs to the end of the document and has no closing fence line.
  if (lastLine !== undefined && isFenceLine(markdown, lastLine)) {
    return linesAfterOpeningFence.slice(0, -1);
  }
  return linesAfterOpeningFence;
}

/** Returns true when the line is a code fence (``` or ~~~). */
function isFenceLine(markdown: string, line: Range): boolean {
  const lineText = markdown.slice(line.start, line.end);
  return fenceLinePattern.test(lineText);
}

/** Returns the ranges of the lines between two offsets, without the newline characters. */
function lineRanges(markdown: string, start: number, end: number): Range[] {
  const lines: Range[] = [];
  let lineStart = start;
  while (lineStart <= end) {
    const currentLineEnd = lineEnd(markdown, lineStart, end);
    lines.push({ start: lineStart, end: currentLineEnd });
    lineStart = currentLineEnd + 1;
  }
  return lines;
}

/** Returns the offset of the next newline at or after `start`, or `limit` if there is none before it. */
function lineEnd(markdown: string, start: number, limit: number): number {
  const newlineIndex = markdown.indexOf("\n", start);
  if (newlineIndex === -1 || newlineIndex > limit) {
    return limit;
  }
  return newlineIndex;
}
