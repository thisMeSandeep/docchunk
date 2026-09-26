// Checks chunkDocuments: results in source order, per-document errors, shared options, and the signal.
import { describe, expect, it } from "vitest";
import { chunkDocument, chunkDocuments, DocchunkError } from "../src/index";

const fixtureFolder = "test/fixtures/conversion";

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

describe("chunkDocuments", () => {
  it("returns one item per source, in order, with a broken file as an error item", async () => {
    const items = await chunkDocuments([
      { path: `${fixtureFolder}/java-vs-go.md` },
      { path: `${fixtureFolder}/java-vs-go.docx` },
      { path: `${fixtureFolder}/missing.pdf` },
      { path: `${fixtureFolder}/text.pdf` },
    ]);
    expect(items.map((item) => item.ok)).toEqual([true, true, false, true]);
    const failed = items[2];
    if (failed === undefined || failed.ok) {
      throw new Error("Expected an error item");
    }
    expect(failed.sourceIndex).toBe(2);
    expect(failed.error).toBeInstanceOf(DocchunkError);
    expect(failed.error.code).toBe("FILE_NOT_FOUND");
  });

  it("gives each document the same result chunkDocument gives on its own", async () => {
    const sources = [
      { path: `${fixtureFolder}/sample.pptx` },
      { path: `${fixtureFolder}/sample.rtf` },
    ];
    const items = await chunkDocuments(sources, { concurrency: 1 });
    for (const [index, source] of sources.entries()) {
      const item = items[index];
      const single = await chunkDocument(source);
      expect(item?.ok && item.result.chunks).toEqual(single.chunks);
    }
  });

  it("applies the options to every document", async () => {
    const items = await chunkDocuments(
      [
        { content: "First document.", format: "markdown" },
        { content: "Second.", format: "text" },
      ],
      { concurrency: 8, metadata: { team: "legal" } },
    );
    for (const item of items) {
      expect(item.ok && item.result.chunks[0]?.metadata).toEqual({ team: "legal" });
    }
  });

  it("returns an empty list for no sources", async () => {
    expect(await chunkDocuments([])).toEqual([]);
  });
});

describe("chunkDocuments errors", () => {
  it("rejects a concurrency that is not a positive integer", async () => {
    for (const concurrency of [0, 1.5]) {
      const error = await rejection(chunkDocuments([], { concurrency }));
      expect(error.code).toBe("INVALID_OPTIONS");
      expect(error.message).toContain('Option "concurrency" must be a positive integer');
    }
  });

  it("rejects bad options once for the whole batch, before reading any file", async () => {
    const error = await rejection(
      chunkDocuments([{ path: `${fixtureFolder}/missing.pdf` }], { strategy: "fixed", size: 0 }),
    );
    expect(error.code).toBe("INVALID_OPTIONS");
  });

  it("rejects sources that are not an array", async () => {
    // @ts-expect-error JavaScript callers can pass any value.
    const error = await rejection(chunkDocuments({ path: "a.md" }));
    expect(error.code).toBe("INVALID_OPTIONS");
  });
});

describe("chunkDocuments with a signal", () => {
  it("rejects with ABORTED when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await rejection(
      chunkDocuments([{ content: "Text.", format: "markdown" }], { signal: controller.signal }),
    );
    expect(error.code).toBe("ABORTED");
  });

  it("stops the batch with ABORTED when the signal is aborted while documents are chunked", async () => {
    const controller = new AbortController();
    const sources = Array.from({ length: 6 }, () => ({ path: `${fixtureFolder}/java-vs-go.docx` }));
    const pending = chunkDocuments(sources, { concurrency: 2, signal: controller.signal });
    controller.abort();
    expect((await rejection(pending)).code).toBe("ABORTED");
  });
});
