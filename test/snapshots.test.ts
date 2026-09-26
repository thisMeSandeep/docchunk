// Snapshot tests (PRD 11, item 7): every fixture under every strategy must give the committed output on every runtime.
// To update after an intended change: `bun run test -- -u`, and give the reason in the commit message.
import { describe, expect, it } from "vitest";
import { type ChunkOptions, type ChunkResult, chunkDocument } from "../src/index";
import { hashText } from "../src/output/hash";

/** Every fixture file, as a path from the repository root. */
const fixturePaths = [
  ...[
    "crlf-bom.md",
    "empty.md",
    "headings-only.md",
    "large-table.md",
    "long-code-block.md",
    "long-list.md",
    "long-paragraph.md",
    "mixed-blocks.md",
    "multilingual.md",
    "nested-headings.md",
    "whitespace-only.md",
  ].map((name) => `test/fixtures/markdown/${name}`),
  "test/fixtures/text/plain-paragraphs.txt",
  ...[
    "java-vs-go.docx",
    "java-vs-go.epub",
    "java-vs-go.md",
    "java-vs-go.txt",
    "sample.odt",
    "sample.pptx",
    "sample.rtf",
    "sample.xls",
    "sample.xlsx",
    "scanned.pdf",
    "short-text.pdf",
    "survey.csv",
    "text.pdf",
  ].map((name) => `test/fixtures/conversion/${name}`),
];

/** Every strategy with its default options, plus hierarchical by heading. */
const strategyRuns: [string, ChunkOptions][] = [
  ["structure", { strategy: "structure" }],
  ["sentence", { strategy: "sentence" }],
  ["paragraph", { strategy: "paragraph" }],
  ["heading", { strategy: "heading" }],
  ["sentence-window", { strategy: "sentence-window" }],
  ["parent-child", { strategy: "parent-child" }],
  ["hierarchical", { strategy: "hierarchical" }],
  ["hierarchical by heading", { strategy: "hierarchical", by: "heading" }],
  ["fixed", { strategy: "fixed" }],
  ["fixed-overlap", { strategy: "fixed-overlap" }],
  ["recursive", { strategy: "recursive" }],
  ["sliding-window", { strategy: "sliding-window" }],
];

/** Returns one run as text: document facts, warnings, and one line per chunk. The chunk text is covered by its hash. */
function describeResult(runName: string, result: ChunkResult): string {
  const indexById = new Map(result.chunks.map((chunk) => [chunk.id, chunk.index]));
  const lines = [
    `== ${runName}`,
    `document ${result.document.id} ${result.document.sourceFormat} ${result.document.charCount} chars`,
  ];
  for (const warning of result.warnings) {
    lines.push(`warning ${warning.code} chunk=${warning.chunkIndex ?? "-"} ${warning.message}`);
  }
  for (const chunk of result.chunks) {
    const level = chunk.level === undefined ? "" : ` level=${chunk.level}`;
    const parent = chunk.parentId === undefined ? "" : ` parent=${indexById.get(chunk.parentId)}`;
    const context = chunk.contextText === undefined ? "" : ` context=${chunk.contextText.length}`;
    // Ids, hashes, and heading paths are shortened: any change to them still changes the line.
    const path = hashText(JSON.stringify(chunk.headingPath)).slice(0, 8);
    lines.push(
      `${chunk.index} ${chunk.start}-${chunk.end} ${chunk.charCount}${level}${parent}${context}` +
        ` id=${chunk.id.slice(0, 10)} text=${chunk.contentHash.slice(0, 10)}` +
        ` path=${path} blocks=${chunk.blockTypes.join(",")}`,
    );
  }
  return lines.join("\n");
}

describe("snapshots", () => {
  for (const fixturePath of fixturePaths) {
    const fileName = fixturePath.split("/").at(-1) ?? fixturePath;
    it(`matches the committed output for ${fileName}`, async () => {
      const sections: string[] = [];
      for (const [runName, options] of strategyRuns) {
        const result = await chunkDocument({ path: fixturePath }, options);
        sections.push(describeResult(runName, result));
      }
      await expect(`${sections.join("\n\n")}\n`).toMatchFileSnapshot(
        `snapshots/${fileName}.snap.txt`,
      );
    });
  }
});
