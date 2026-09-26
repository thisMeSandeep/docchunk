// Type tests (PRD 11, item 6): valid option combinations compile and invalid ones do not.
// `bun run typecheck` checks this file; every @ts-expect-error line must really be an error, or tsc fails.
import { describe, expectTypeOf, it } from "vitest";
import {
  type BatchItem,
  type BatchOptions,
  buildChunkTree,
  type Chunk,
  type ChunkOptions,
  type ChunkResult,
  type ChunkTreeNode,
  chunkDocument,
  chunkDocuments,
  type DocumentSource,
  type StrategyName,
} from "../src/index";
import type { ResolvedStrategyOptions, StrategyDefinition } from "../src/strategies/strategy-types";

describe("ChunkOptions accepts valid combinations", () => {
  it("accepts every strategy with its own options and the common options", () => {
    const options: ChunkOptions[] = [
      {},
      { size: 1000, minSize: 100, overlapChars: 50, headingLevel: 2 },
      { strategy: "structure", size: 1000 },
      { strategy: "sentence", size: 500, minSize: 10, overlapChars: 20 },
      { strategy: "paragraph", size: 800 },
      { strategy: "heading", size: 3000, headingLevel: 2 },
      { strategy: "sentence-window", windowSize: 2 },
      { strategy: "parent-child", parentSize: 4000, childSize: 800 },
      { strategy: "hierarchical", by: "heading", headingLevel: 2, leafSize: 1000 },
      { strategy: "hierarchical", levels: [3000, 1000, 300] },
      { strategy: "fixed", size: 1000, boundary: "char" },
      { strategy: "fixed-overlap", size: 1000, overlapChars: 100, boundary: "word" },
      { strategy: "recursive", size: 1000, separators: ["\n\n", "\n"] },
      { strategy: "sliding-window", size: 1000, step: 250 },
      { strategy: "fixed", metadata: { team: "legal" }, documentId: "doc-1", headingPrefix: true },
      { signal: new AbortController().signal },
    ];
    expectTypeOf(options).toExtend<ChunkOptions[]>();
  });

  it("lists exactly the 11 strategy names", () => {
    expectTypeOf<StrategyName>().toEqualTypeOf<
      | "structure"
      | "sentence"
      | "paragraph"
      | "heading"
      | "sentence-window"
      | "parent-child"
      | "hierarchical"
      | "fixed"
      | "fixed-overlap"
      | "recursive"
      | "sliding-window"
    >();
  });
});

describe("ChunkOptions rejects invalid combinations", () => {
  it("rejects options that belong to another strategy", () => {
    // @ts-expect-error overlapChars is not a fixed option.
    const fixedWithOverlap: ChunkOptions = { strategy: "fixed", overlapChars: 200 };
    // @ts-expect-error sentence-window has no size.
    const windowWithSize: ChunkOptions = { strategy: "sentence-window", size: 500 };
    // @ts-expect-error parentSize belongs to parent-child, not hierarchical.
    const hierarchicalWithParent: ChunkOptions = { strategy: "hierarchical", parentSize: 4000 };
    // @ts-expect-error levels belongs to hierarchical, not parent-child.
    const parentChildWithLevels: ChunkOptions = { strategy: "parent-child", levels: [100] };
    // @ts-expect-error boundary is not a structure option, so it needs a strategy that has it.
    const defaultWithBoundary: ChunkOptions = { boundary: "char" };
    expectTypeOf([
      fixedWithOverlap,
      windowWithSize,
      hierarchicalWithParent,
      parentChildWithLevels,
      defaultWithBoundary,
    ]).toExtend<ChunkOptions[]>();
  });

  it("rejects unknown strategies and values of the wrong type", () => {
    // @ts-expect-error "semantic" is not a strategy.
    const unknownStrategy: ChunkOptions = { strategy: "semantic" };
    // @ts-expect-error size is a number, not a string.
    const textSize: ChunkOptions = { size: "1500" };
    // @ts-expect-error boundary is "word" or "char".
    const lineBoundary: ChunkOptions = { strategy: "fixed", boundary: "line" };
    // @ts-expect-error by is "size" or "heading".
    const byPage: ChunkOptions = { strategy: "hierarchical", by: "page" };
    // @ts-expect-error metadata is an object.
    const textMetadata: ChunkOptions = { metadata: "legal" };
    expectTypeOf([unknownStrategy, textSize, lineBoundary, byPage, textMetadata]).toExtend<
      ChunkOptions[]
    >();
  });

  it("accepts concurrency only in chunkDocuments", () => {
    const batch: BatchOptions = { strategy: "fixed", concurrency: 8 };
    expectTypeOf(batch).toExtend<BatchOptions>();
    // @ts-expect-error concurrency is a chunkDocuments option.
    const single: ChunkOptions = { concurrency: 8 };
    expectTypeOf(single).toExtend<ChunkOptions>();
  });
});

describe("DocumentSource", () => {
  it("accepts a path, bytes, or Markdown and text content", () => {
    const sources: DocumentSource[] = [
      { path: "report.pdf" },
      { bytes: new Uint8Array(), filename: "report.pdf", format: "pdf" },
      { content: "# Title", format: "markdown" },
      { content: "Plain text", format: "text" },
    ];
    expectTypeOf(sources).toExtend<DocumentSource[]>();
  });

  it("rejects content without a format, and content in a format that needs conversion", () => {
    // @ts-expect-error content needs format "markdown" or "text".
    const noFormat: DocumentSource = { content: "# Title" };
    // @ts-expect-error content cannot be a PDF; pass bytes or a path instead.
    const pdfContent: DocumentSource = { content: "...", format: "pdf" };
    // @ts-expect-error "html" is not a supported format.
    const htmlBytes: DocumentSource = { bytes: new Uint8Array(), format: "html" };
    expectTypeOf([noFormat, pdfContent, htmlBytes]).toExtend<DocumentSource[]>();
  });
});

describe("function and result types", () => {
  it("types the public functions", () => {
    expectTypeOf(chunkDocument).returns.resolves.toEqualTypeOf<ChunkResult>();
    expectTypeOf(chunkDocuments).returns.resolves.toEqualTypeOf<BatchItem[]>();
    expectTypeOf(buildChunkTree).parameter(0).toEqualTypeOf<Chunk[]>();
    expectTypeOf(buildChunkTree).returns.toEqualTypeOf<ChunkTreeNode[]>();
  });

  it("narrows a batch item by ok", () => {
    const checkItem = (item: BatchItem): void => {
      if (item.ok) {
        expectTypeOf(item.result).toEqualTypeOf<ChunkResult>();
      } else {
        expectTypeOf(item.sourceIndex).toEqualTypeOf<number>();
      }
    };
    expectTypeOf(checkItem).toBeFunction();
  });

  it("gives resolved strategy options a value for every option", () => {
    expectTypeOf<ResolvedStrategyOptions["fixed"]>().toEqualTypeOf<{
      size: number;
      boundary: "word" | "char";
    }>();
    expectTypeOf<StrategyDefinition<"fixed">["defaults"]>().toEqualTypeOf<
      ResolvedStrategyOptions["fixed"]
    >();
  });
});
