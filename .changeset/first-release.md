---
"docchunk": major
---

First release of docchunk: local document chunking for RAG.

- `chunkDocument` for PDF (text-based), Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV, Markdown, and plain text, converted locally with anydoc.
- `chunkDocuments` for batches, with a concurrency limit and one result or error per document.
- 11 strategies: structure (default), sentence, paragraph, heading, sentence-window, parent-child, hierarchical, recursive, fixed, fixed-overlap, and sliding-window.
- Stable chunk ids and content hashes, heading paths, parent and child links, and `buildChunkTree`.
- Warnings for scanned PDFs, empty documents, oversized blocks, and large chunks; `DocchunkError` with a code for every failure.
- No network access in any code path. ESM and CJS builds with TypeScript types, for Node.js 22.12+ and Bun.
