// Checks the signal option: ABORTED before reading, after converting, between hierarchical levels, and in batches.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type ContentSource, chunkDocument, chunkDocuments, DocchunkError } from "../src/index";
import { normalizeMarkdown } from "../src/ir/normalize-markdown";
import { parseMarkdown } from "../src/ir/parse-markdown";
import { hierarchicalStrategy } from "../src/strategies/hierarchical";

/** Returns an AbortSignal that reports aborted from its Nth read of `aborted` on, counting from 1. */
function signalAbortedOnRead(readNumber: number): AbortSignal {
  const signal = new AbortController().signal;
  let reads = 0;
  // An own getter shadows AbortSignal's, so the signal flips at an exact point during a run.
  Object.defineProperty(signal, "aborted", {
    get: () => {
      reads++;
      return reads >= readNumber;
    },
  });
  return signal;
}

/** Returns the error the promise rejects with. Fails the test if it resolves. */
async function rejection(promise: Promise<unknown>): Promise<DocchunkError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DocchunkError) {
      return error;
    }
    throw error;
  }
  throw new Error("The promise did not reject");
}

describe("signal in chunkDocument", () => {
  it("throws ABORTED before reading the source when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort("user cancelled");
    // The path does not exist: ABORTED instead of FILE_NOT_FOUND shows the check comes first.
    const error = await rejection(
      chunkDocument({ path: "missing.docx" }, { signal: controller.signal }),
    );
    expect(error.code).toBe("ABORTED");
    expect(error.message).toBe("Chunking was aborted.");
    expect(error.cause).toBe("user cancelled");
  });

  it("throws ABORTED after conversion when the signal is aborted while the file is converted", async () => {
    const controller = new AbortController();
    const pending = chunkDocument(
      { path: "test/fixtures/conversion/java-vs-go.docx" },
      { signal: controller.signal },
    );
    controller.abort();
    expect((await rejection(pending)).code).toBe("ABORTED");
  });

  it("gives the same result with a signal that is never aborted", async () => {
    const source = { path: "test/fixtures/conversion/java-vs-go.md" };
    const withSignal = await chunkDocument(source, { signal: new AbortController().signal });
    const withoutSignal = await chunkDocument(source);
    expect(withSignal.chunks).toEqual(withoutSignal.chunks);
  });
});

describe("signal in the hierarchical strategy", () => {
  const markdown = normalizeMarkdown(readFileSync("test/fixtures/markdown/long-list.md", "utf8"));
  const ir = { markdown, blocks: parseMarkdown(markdown, 3) };
  const bySize = { ...hierarchicalStrategy.defaults, levels: [2000, 600, 150] };

  it("checks the signal before each level by size, so it stops between levels", () => {
    // The first read (before level 0) passes; the second (before level 1) is aborted.
    const split = () => hierarchicalStrategy.split(ir, bySize, signalAbortedOnRead(2));
    expect(split).toThrow(expect.objectContaining({ code: "ABORTED" }));
  });

  it("checks the signal between the sections and their children by heading", () => {
    const byHeading = { ...hierarchicalStrategy.defaults, by: "heading" as const };
    const split = () => hierarchicalStrategy.split(ir, byHeading, signalAbortedOnRead(1));
    expect(split).toThrow(expect.objectContaining({ code: "ABORTED" }));
  });

  it("runs to the end when the signal is never aborted", () => {
    const withSignal = hierarchicalStrategy.split(ir, bySize, new AbortController().signal);
    expect(withSignal).toEqual(hierarchicalStrategy.split(ir, bySize));
  });
});

describe("signal in chunkDocuments", () => {
  it("stops a batch of content strings when a callback aborts the signal during the batch", async () => {
    const controller = new AbortController();
    const sources: ContentSource[] = Array.from({ length: 5 }, () => ({
      content: "Some text.",
      format: "text",
    }));
    // Queued before the batch starts, so it runs at the batch's first turn of the event loop.
    setImmediate(() => controller.abort());
    const error = await rejection(
      chunkDocuments(sources, { signal: controller.signal, concurrency: 1 }),
    );
    expect(error.code).toBe("ABORTED");
  });
});
