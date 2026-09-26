// Finds lines of source code that import network modules or reference fetch.

/** Matches an import or require of node:net, node:http, node:https, or node:tls (with or without "node:"). */
const networkImportPattern =
  /\b(?:from|import|require)\s*\(?\s*["'](?:node:)?(?:net|http|https|tls)["']/;

/** Matches the word fetch, but not words that contain it, such as prefetch. */
const fetchPattern = /\bfetch\b/;

/** One line that uses the network. */
export interface NetworkUse {
  lineNumber: number;
  line: string;
}

/** Returns every line in the source text that imports a network module or references fetch. */
export function findNetworkUses(sourceText: string): NetworkUse[] {
  const networkUses: NetworkUse[] = [];
  const lines = sourceText.split("\n");
  for (const [lineIndex, line] of lines.entries()) {
    const isNetworkImport = networkImportPattern.test(line);
    const isFetchReference = fetchPattern.test(line);
    if (isNetworkImport || isFetchReference) {
      networkUses.push({ lineNumber: lineIndex + 1, line: line.trim() });
    }
  }
  return networkUses;
}
