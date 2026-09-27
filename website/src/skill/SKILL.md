---
name: docchunk
description: Split documents into chunks for RAG and embeddings with the docchunk TypeScript library on Node.js 22.12+ or Bun. Use when writing code that chunks PDF, Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV, Markdown, or plain text files, chooses a chunking strategy, or indexes documents into a vector database with docchunk.
---

# docchunk

docchunk turns documents into chunks ready for embedding. It runs locally: no API key, no network requests, no telemetry. PDFs and Office files are converted to Markdown by `@firecrawl/anydoc`; Markdown and plain text are read directly.

Full documentation as one Markdown file: https://thismesandeep.github.io/docchunk/llms-full.txt

## Install

```sh
npm install docchunk   # or: pnpm add docchunk, yarn add docchunk, bun add docchunk
```

Requires Node.js 22.12 or later, or Bun 1.x. Works with `import` and `require`. Types are included.

## Basic use

```ts
import { chunkDocument } from "docchunk";

const result = await chunkDocument({ path: "handbook.pdf" });

for (const chunk of result.chunks) {
  console.log(chunk.id, chunk.headingPath, chunk.text);
}
```

With no options, the `structure` strategy is used with chunks of up to 1,500 characters.

## Sources

The first argument is one of:

| Source | Use for |
|---|---|
| `{ path }` | A file on disk. |
| `{ bytes, filename?, format? }` | A file in memory, as a `Uint8Array` or `Buffer`. |
| `{ content, format }` | A string. `format` is `"markdown"` or `"text"`. |

Supported formats: `pdf`, `docx`, `doc`, `pptx`, `ppt`, `xlsx`, `xls`, `odt`, `ods`, `odp`, `rtf`, `epub`, `csv`, `markdown`, `text`.

## Result

`chunkDocument` returns `{ chunks, document, stats, warnings }`.

- Each chunk has `id` (stable), `text` (Markdown, what you embed), `index`, `start`, `end`, `charCount`, `headingPath` (headings above the chunk), `blockTypes`, `contentHash` (hash of `text`), and `metadata`.
- `sentence-window` chunks also have `contextText`. `parent-child` and `hierarchical` chunks also have `level`, `parentId`, and `childIds`.
- `document` has `id`, `markdown` (the text that `start` and `end` point into), `sourceFormat`, `sourcePath`, and `charCount`.
- `stats` has `count`, `minChars`, `maxChars`, `avgChars`, and `durationMs`.
- `warnings` is an array of `{ code, message, chunkIndex? }`. docchunk never logs them.

## Choosing a strategy

Pass `strategy` and that strategy's options as the second argument. Start with `structure`.

| Goal | Strategy | Options (defaults) |
|---|---|---|
| General-purpose chunks | `structure` | `size` (1500), `minSize` (200, or `size` if smaller), `overlapChars` (0), `headingLevel` (3) |
| One chunk per section | `heading` | `size` (no limit), `headingLevel` (3) |
| One chunk per paragraph, list, or table | `paragraph` | `size` (no limit), `minSize` (1), `overlapChars` (0) |
| One chunk per sentence | `sentence` | `size` (no limit), `minSize` (1), `overlapChars` (0) |
| Sentences for search, neighbors as context | `sentence-window` | `windowSize` (3) |
| Small chunks for search, large parents for the model | `parent-child` | `parentSize` (4000), `childSize` (800) |
| Three or more nested sizes, or a chunk per section and subsection | `hierarchical` | `by` ("size"), `levels` ([6000, 1500, 400]), `headingLevel` (3), `leafSize` (1500) |
| Match a recursive character splitter | `recursive` | `size` (1500), `overlapChars` (0), `separators` |
| Fixed-length cuts, ignoring structure | `fixed` | `size` (1500), `boundary` ("word") |
| Fixed-length cuts with overlap | `fixed-overlap` | `size` (1500), `overlapChars` (200), `boundary` ("word") |
| Overlapping windows | `sliding-window` | `size` (1500), `step` (750), `boundary` ("word") |

`structure` packs whole paragraphs, lists, tables, and code blocks up to `size`, never puts two sections in one chunk, and splits a block that is too large by rows, items, lines, or sentences.

Options every strategy accepts: `metadata` (copied onto every chunk), `documentId` (used in chunk ids instead of a hash of the content), `headingPrefix` (adds `A > B > C` and a blank line to the start of each chunk's text), and `signal` (an `AbortSignal`).

## Examples

Set the size:

```ts
import { chunkDocument } from "docchunk";

const { chunks } = await chunkDocument({ path: "manual.docx" }, { size: 1000 });
```

Markdown from a string:

```ts
import { chunkDocument } from "docchunk";

const markdown = "# Guide\n\nFirst paragraph.\n\n## Setup\n\nInstall the package.";
const { chunks } = await chunkDocument({ content: markdown, format: "markdown" });
```

Parent-child retrieval: embed the children, send a matching child's parent to the model.

```ts
import { chunkDocument } from "docchunk";

const { chunks } = await chunkDocument({ path: "policy.pdf" }, { strategy: "parent-child" });

const children = chunks.filter((chunk) => chunk.level === 1);
const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));

for (const child of children) {
  const parent = chunksById.get(child.parentId ?? "");
  console.log(child.text.length, parent?.text.length);
}
```

Many documents. One failed document doesn't stop the others:

```ts
import { chunkDocuments } from "docchunk";

const results = await chunkDocuments(
  [{ path: "a.docx" }, { path: "b.pdf" }, { path: "notes.md" }],
  { concurrency: 4 },
);

for (const item of results) {
  if (item.ok) {
    console.log(item.result.document.sourcePath, item.result.chunks.length);
  } else {
    console.log(`Source ${item.sourceIndex} failed: ${item.error.code}`);
  }
}
```

Re-index only what changed: compare `contentHash` with the stored value.

```ts
import { chunkDocument } from "docchunk";

const storedHashes = new Set<string>(); // load from your vector database
const { chunks } = await chunkDocument(
  { path: "docs/returns.md" },
  { documentId: "docs/returns.md" },
);
const changed = chunks.filter((chunk) => !storedHashes.has(chunk.contentHash));
```

## Errors and warnings

Errors are thrown as `DocchunkError`, with a `code`:

| Code | When |
|---|---|
| `INVALID_OPTIONS` | Bad option value, an option the strategy doesn't accept, or a malformed source. |
| `UNSUPPORTED_FORMAT` | Unknown format, or the format can't be detected. |
| `FILE_NOT_FOUND` | The `path` doesn't exist, is a folder, or can't be read. |
| `CONVERSION_FAILED` | The converter failed (damaged or password-protected file), or isn't available on this platform. |
| `ABORTED` | The `signal` was aborted. |

```ts
import { chunkDocument, DocchunkError } from "docchunk";

try {
  await chunkDocument({ path: "report.pdf" });
} catch (error) {
  if (error instanceof DocchunkError) {
    console.log(error.code, error.message);
  }
}
```

Warnings: `EMPTY_DOCUMENT` (no text, no chunks), `NO_TEXT_LAYER` (scanned PDF, no chunks), `OVERSIZED_BLOCK` (a row, item, line, or word longer than `size` was cut), `LARGE_CHUNK` (a strategy without a size limit made a chunk over 8,000 characters).

## Pitfalls

- Sizes are in characters, not tokens. For English prose, use about 3 characters per token: `size: 1500` for a 512-token embedding model. Use less for code and non-Latin scripts.
- Options are specific to the strategy. An option the chosen strategy doesn't accept throws `INVALID_OPTIONS`, and TypeScript flags it.
- Markdown, text, and CSV passed as `bytes` need a `filename` with the extension, or a `format`. Otherwise `UNSUPPORTED_FORMAT` is thrown.
- No OCR. Images on pages with text are ignored, but a PDF with any page that has no text layer (scanned, or only an image) returns no chunks and a `NO_TEXT_LAYER` warning. Always check `result.warnings`.
- With `noUncheckedIndexedAccess`, `chunks[0]` has type `Chunk | undefined`. Use `for...of`, or check for `undefined`.
- Don't pass `documentId` to `chunkDocuments`: every document would get the same id, and chunk ids would collide. For per-document ids, call `chunkDocument` for each document.
- Without `documentId`, two files with the same content get the same chunk ids, and any edit changes every chunk id. Pass a stable `documentId`, such as the file path, when storing chunks from many documents.
- `sentence` and `sentence-window` leave headings out of `text`. Use `headingPath` or `headingPrefix: true` to keep them.
- Not supported: browsers, Deno, HTML input, token-based sizes, and semantic (embedding-based) chunking.
