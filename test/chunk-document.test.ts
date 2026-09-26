// Checks chunkDocument on in-memory Markdown and text: the result shape, warnings, ids, and source errors.
import { describe, expect, it } from "vitest";
import { chunkDocument, DocchunkError } from "../src/index";
import { hashText } from "../src/output/hash";

/** Returns the error chunkDocument rejects with. Fails the test if it resolves. */
async function chunkError(source: unknown): Promise<DocchunkError> {
  try {
    // @ts-expect-error The tests pass sources that TypeScript users could not write.
    await chunkDocument(source, { strategy: "fixed" });
  } catch (error) {
    if (error instanceof DocchunkError) {
      return error;
    }
    throw error;
  }
  throw new Error("chunkDocument did not reject");
}

describe("chunkDocument with Markdown content", () => {
  it("returns chunks, document info, stats, and no warnings", async () => {
    const content = "# Title\n\nFirst paragraph.\n\nSecond paragraph.";
    const result = await chunkDocument(
      { content, format: "markdown" },
      { strategy: "fixed", size: 20 },
    );
    // The word search covers only the last 10% (2 characters), so these cuts land inside words.
    expect(result.chunks.map((chunk) => chunk.text)).toEqual([
      "# Title\n\nFirst parag",
      "raph.\n\nSecond paragr",
      "aph.",
    ]);
    expect(result.document).toEqual({
      id: hashText(content),
      markdown: content,
      sourceFormat: "markdown",
      charCount: content.length,
    });
    expect(result.stats.count).toBe(3);
    expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.warnings).toEqual([]);
  });

  it("uses the Markdown's heading paths", async () => {
    const content = "# Title\n\nText under the title.";
    const result = await chunkDocument({ content, format: "markdown" }, { strategy: "fixed" });
    expect(result.chunks[0]?.headingPath).toEqual(["Title"]);
  });

  it("normalizes line endings and the BOM, and offsets refer to the normalized Markdown", async () => {
    const result = await chunkDocument(
      { content: "﻿# Title\r\n\r\nText.", format: "markdown" },
      { strategy: "fixed" },
    );
    expect(result.document.markdown).toBe("# Title\n\nText.");
    const [chunk] = result.chunks;
    expect(chunk?.text).toBe(result.document.markdown.slice(chunk?.start, chunk?.end));
  });

  it("uses the documentId option instead of the Markdown's hash", async () => {
    const source = { content: "Some text.", format: "markdown" } as const;
    const withId = await chunkDocument(source, { strategy: "fixed", documentId: "report-7" });
    const withoutId = await chunkDocument(source, { strategy: "fixed" });
    expect(withId.document.id).toBe("report-7");
    expect(withId.chunks[0]?.id).not.toBe(withoutId.chunks[0]?.id);
  });

  it("copies the metadata option onto every chunk", async () => {
    const result = await chunkDocument(
      { content: "One two three four five six.", format: "markdown" },
      { strategy: "fixed", size: 10, metadata: { team: "legal" } },
    );
    for (const chunk of result.chunks) {
      expect(chunk.metadata).toEqual({ team: "legal" });
    }
  });
});

describe("chunkDocument with text content", () => {
  it("reads plain text without Markdown: no headings, # stays as text", async () => {
    const result = await chunkDocument(
      { content: "# Not a heading\n\nParagraph.", format: "text" },
      { strategy: "fixed" },
    );
    expect(result.document.sourceFormat).toBe("text");
    expect(result.chunks[0]?.headingPath).toEqual([]);
    expect(result.chunks[0]?.blockTypes).toEqual(["paragraph"]);
  });
});

describe("chunkDocument with empty documents", () => {
  it("returns no chunks and an EMPTY_DOCUMENT warning", async () => {
    for (const content of ["", "  \n\n\t "]) {
      const result = await chunkDocument({ content, format: "markdown" }, { strategy: "fixed" });
      expect(result.chunks).toEqual([]);
      expect(result.warnings).toEqual([
        { code: "EMPTY_DOCUMENT", message: "The document has no text to chunk." },
      ]);
      expect(result.stats.count).toBe(0);
    }
  });
});

describe("chunkDocument errors", () => {
  it("rejects bad options with INVALID_OPTIONS", async () => {
    const reject = chunkDocument(
      { content: "Text.", format: "markdown" },
      { strategy: "fixed", size: 0 },
    );
    await expect(reject).rejects.toThrow('Option "size" must be a positive integer');
  });

  it("rejects file and bytes sources until file input exists", async () => {
    const pathError = await chunkError({ path: "report.pdf" });
    const bytesError = await chunkError({ bytes: new Uint8Array() });
    expect(pathError.code).toBe("UNSUPPORTED_FORMAT");
    expect(bytesError.code).toBe("UNSUPPORTED_FORMAT");
  });

  it("rejects a source that is not an object, or has no string content", async () => {
    expect((await chunkError(null)).code).toBe("INVALID_OPTIONS");
    const missingContent = await chunkError({ format: "markdown" });
    expect(missingContent.code).toBe("INVALID_OPTIONS");
    expect(missingContent.message).toBe("The source's content must be a string.");
  });

  it("rejects a content format other than markdown or text with UNSUPPORTED_FORMAT", async () => {
    const htmlError = await chunkError({ content: "<p>Text.</p>", format: "html" });
    expect(htmlError.code).toBe("UNSUPPORTED_FORMAT");
    expect(htmlError.message).toBe('The source\'s format must be "markdown" or "text".');
  });
});
