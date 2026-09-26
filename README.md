# docchunk

Turn documents into chunks ready for embedding and retrieval (RAG), entirely on your machine.

- **Many formats in, one output out:** PDF (text-based), Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV, Markdown, and plain text.
- **11 chunking strategies** behind one function, from simple fixed-size cuts to heading-aware, sentence-window, and parent-child chunks.
- **Stable output:** the same document and options always give the same chunks and ids, so you can re-index only what changed.
- **Fully local:** no server, no API key, no network access, no telemetry.

Office documents and PDFs are converted to Markdown by [`@firecrawl/anydoc`](https://github.com/firecrawl/anydoc), which runs locally. Markdown and text files skip conversion.

## Install

```bash
npm install docchunk
# or
bun add docchunk
```

Requires Node.js 22.12 or later, or Bun 1.x. Works with both `import` and `require`.

## Quick start

```ts
import { chunkDocument } from "docchunk";

// 1. Any document, with the default strategy
const { chunks } = await chunkDocument({ path: "report.pdf" });
console.log(chunks[0]?.text, chunks[0]?.headingPath);
```

```ts
import { chunkDocument } from "docchunk";

// 2. Pick a strategy and a size
await chunkDocument({ path: "manual.docx" }, { strategy: "heading", size: 3000 });
```

```ts
import { chunkDocument } from "docchunk";

// 3. Markdown already in memory
const markdownString = "# Guide\n\nFirst paragraph.\n\n## Setup\n\nInstall the package.";
await chunkDocument({ content: markdownString, format: "markdown" });
```

```ts
import { chunkDocument } from "docchunk";

// 4. Parent-child retrieval: embed the small children, send their large parents to the LLM
const { chunks: all } = await chunkDocument({ path: "policy.pdf" }, { strategy: "parent-child" });
const children = all.filter((chunk) => chunk.level === 1);
const chunksById = new Map(all.map((chunk) => [chunk.id, chunk]));
// After a search returns a child: const parent = chunksById.get(hit.parentId!)
console.log(children.length, chunksById.size);
```

```ts
import { chunkDocuments } from "docchunk";

// 5. Several documents; one failed document does not stop the others
const results = await chunkDocuments(
  [{ path: "a.docx" }, { path: "b.pdf" }, { path: "notes.md" }],
  { concurrency: 8, metadata: { team: "legal" } },
);
for (const item of results) {
  if (item.ok) {
    console.log(item.result.document.sourceFormat, item.result.chunks.length);
  } else {
    console.log(`Source ${item.sourceIndex} failed: ${item.error.code}`);
  }
}
```

A source is one of `{ path }`, `{ bytes, filename?, format? }`, or `{ content, format: "markdown" | "text" }`.

## Supported formats

| Format | Extensions | Notes |
|---|---|---|
| PDF | `.pdf` | Text-based PDFs. Images are skipped. Scanned pages are not supported (no OCR). |
| Word | `.docx`, `.doc` | |
| PowerPoint | `.pptx`, `.ppt` | |
| Excel | `.xlsx`, `.xls` | Each sheet becomes a Markdown table. |
| OpenDocument | `.odt`, `.ods`, `.odp` | |
| RTF, EPUB | `.rtf`, `.epub` | |
| CSV | `.csv` | CSV has no content signature: use a `.csv` name or pass `format: "csv"`. |
| Markdown | `.md`, `.markdown` | Not converted. |
| Plain text | `.txt` | Not converted. Split on blank lines; `#` and `*` stay as text. |

The format comes from `format` if you pass it, then from a `.md`, `.markdown`, `.txt`, or `.csv` name, then from the file's content.

## Strategies

All sizes are in characters.

| Strategy | What it does | When to use it | Defaults |
|---|---|---|---|
| `structure` (default) | Packs whole blocks (paragraphs, lists, tables, code) up to `size`, never across a section. Keeps tables, code, and lists whole when they fit. | Most documents. The best general choice. | `size: 1500`, `minSize: 200`, `overlapChars: 0`, `headingLevel: 3` |
| `heading` | One chunk per section, split at headings up to `headingLevel`. | Manuals and docs with a clear heading structure. | no size limit, `headingLevel: 3` |
| `paragraph` | One chunk per block, with a heading kept with the block after it. | Short, self-contained paragraphs such as FAQs. | no size limit, `minSize: 1`, `overlapChars: 0` |
| `sentence` | One chunk per sentence. Tables and code blocks count as one sentence each. | Fine-grained search over prose. | no size limit, `minSize: 1`, `overlapChars: 0` |
| `sentence-window` | One chunk per sentence, with `contextText` holding the sentences around it. | Search on single sentences, then give the LLM the surrounding text. | `windowSize: 3` |
| `parent-child` | Two levels: large parents, each split into small children. | Embed the children for precise search, send the parents for context. | `parentSize: 4000`, `childSize: 800` |
| `hierarchical` | Nested chunks at several sizes (`by: "size"`), or one level per heading depth (`by: "heading"`). | Multi-level retrieval, or navigating a document's outline. | `by: "size"`, `levels: [6000, 1500, 400]`, `headingLevel: 3`, `leafSize: 1500` |
| `recursive` | Splits on headings, blank lines, lines, then sentences, spaces, and a hard cut, until pieces fit. | Matching the behavior of common "recursive character" splitters. | `size: 1500`, `overlapChars: 0` |
| `fixed` | Cuts every `size` characters, at a word boundary where possible. Ignores structure. | Baselines and very uniform text. | `size: 1500`, `boundary: "word"` |
| `fixed-overlap` | Like `fixed`, with consecutive chunks sharing `overlapChars` characters. | Uniform text where context at the cuts matters. | `size: 1500`, `overlapChars: 200`, `boundary: "word"` |
| `sliding-window` | A window of `size` characters moving forward `step` characters at a time. | Dense overlapping coverage. | `size: 1500`, `step: 750`, `boundary: "word"` |

When a single block is larger than `size`, it is split along its structure: tables by rows (repeating the header), lists by items, code by lines (keeping the fence), and prose by sentences, then words. A single row, item, line, or word that is still too large is cut at a character boundary and reported with an `OVERSIZED_BLOCK` warning.

## Options

Every option is optional. Choosing a `strategy` limits the options you can pass to that strategy's, and TypeScript flags any others.

| Option | Strategies | Meaning |
|---|---|---|
| `strategy` | all | The strategy to use. Default `"structure"`. |
| `size` | structure, sentence, paragraph, heading, recursive, fixed, fixed-overlap, sliding-window | Maximum characters per chunk. |
| `minSize` | structure, sentence, paragraph | Chunks smaller than this are merged into a neighbor in the same section when the result fits `size`. |
| `overlapChars` | structure, sentence, paragraph, recursive, fixed-overlap | Characters each chunk repeats from the end of the previous one. Must be less than `size`. |
| `headingLevel` | structure, heading, hierarchical | Headings at this level or higher (1 to 6) start a new section. |
| `boundary` | fixed, fixed-overlap, sliding-window | `"word"` moves a cut back to a space near the end of the chunk; `"char"` cuts at exactly `size`. |
| `step` | sliding-window | Characters the window moves forward each time. At most `size`. |
| `separators` | recursive | Separators tried before sentences, spaces, and a hard cut. |
| `windowSize` | sentence-window | Sentences on each side that go into `contextText`. |
| `parentSize`, `childSize` | parent-child | Maximum characters per parent and per child chunk. |
| `by`, `levels`, `leafSize` | hierarchical | `"size"` with one level per entry in `levels`, or `"heading"` with sections split at `leafSize`. |
| `metadata` | all | Copied onto every chunk. Does not change chunk ids. |
| `documentId` | all | Used instead of a hash of the document in every chunk id. |
| `headingPrefix` | all | Prepends the heading path (`"A > B > C"` and a blank line) to each chunk's text. Counts toward `size`. |
| `signal` | all | An `AbortSignal`; aborting stops chunking with an `ABORTED` error. |
| `concurrency` | `chunkDocuments` only | Documents chunked at the same time. Default 4. |

Invalid options throw a `DocchunkError` with code `INVALID_OPTIONS` and a message naming the option.

## Output

`chunkDocument` returns `{ chunks, document, stats, warnings }`.

Each chunk has:

- `id`: stable for the same document, options, and range. Changing only `metadata` keeps it.
- `text`: the chunk text.
- `contextText`: the surrounding text, for `sentence-window` only.
- `index`, `start`, `end`, `charCount`: position in the list and in `document.markdown`, and length in characters.
- `headingPath`: the headings above the start of the chunk, for example `["Guide", "Setup"]`.
- `blockTypes`: the kinds of blocks the chunk touches, for example `["heading", "paragraph"]`.
- `level`, `parentId`, `childIds`: set by `parent-child` and `hierarchical`. `buildChunkTree(chunks)` turns them into a tree.
- `contentHash`: a hash of `text`, to detect changed chunks.
- `metadata`: a copy of the `metadata` option.

`document.markdown` is the normalized Markdown that `start` and `end` point into. For most chunks `text` equals `document.markdown.slice(start, end)`. The exceptions are when `headingPrefix` is on, and pieces of a split table or code block, which repeat the header or fence around their range.

### Warnings and errors

Warnings do not stop chunking:

| Warning | Meaning |
|---|---|
| `EMPTY_DOCUMENT` | The document has no text. No chunks. |
| `NO_TEXT_LAYER` | The PDF is scanned, or has almost no text. No chunks. |
| `OVERSIZED_BLOCK` | A row, item, line, or word longer than `size` was cut. |
| `LARGE_CHUNK` | A strategy without a size limit made a chunk over 8,000 characters. Set `size` to split it. |

Errors are thrown as `DocchunkError` with a `code`: `INVALID_OPTIONS`, `UNSUPPORTED_FORMAT`, `CONVERSION_FAILED`, `FILE_NOT_FOUND`, or `ABORTED`.

```ts
import { chunkDocument, DocchunkError } from "docchunk";

try {
  await chunkDocument({ path: "missing-file.pdf" });
} catch (error) {
  if (error instanceof DocchunkError) {
    console.log(error.code); // "FILE_NOT_FOUND"
  }
}
```

## Choosing a size

Sizes are in characters, not tokens. For English prose, a character limit of about 3 times your embedding model's token limit keeps chunks under it: for example, 1,500 characters for a 512-token model. Use a lower ratio for code and for non-Latin scripts, which use more tokens per character.

## Performance

Typical times with the default strategy, not counting file conversion (they vary with the machine):

| Input | Time |
|---|---|
| 1 MB of prose | about 0.6 s |
| 1 MB of tables (for example, a converted spreadsheet) | about 2 s |

Peak memory is about 250 times the size of the Markdown: roughly 250 MB for 1 MB of text. Almost all of the time and memory goes to parsing the Markdown. When you process large files with `chunkDocuments`, lower `concurrency`, because every document running at once needs its own parsing memory.

## Limitations

- **No OCR.** Scanned PDFs, and PDFs whose pages have no text layer, give a `NO_TEXT_LAYER` warning and no chunks. docchunk never uses anydoc's hosted OCR option.
- **Sizes are in characters.** There is no tokenizer, token counting, or custom length function yet.
- **No HTML input**, no streaming API, no embeddings or semantic chunking, and no vector database integrations. Store the chunks with the tools you already use.
- **Node.js and Bun only.** Browsers and Deno are not supported yet.
- **Platforms:** conversion uses anydoc's native binaries, available for macOS, Linux (glibc and musl), and Windows x64. Windows on ARM can chunk Markdown and text, but cannot convert other formats.
- **Sentence boundaries** come from `Intl.Segmenter`, which may treat abbreviations such as "Dr." or "e.g." as the end of a sentence.
- **Strategies are fixed.** Custom strategies cannot be registered yet.

## License

MIT
