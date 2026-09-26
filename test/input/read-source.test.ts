// Checks readSource: file paths, bytes, and content sources, and the errors for missing files and bad sources.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DocchunkError } from "../../src/errors";
import { readSource } from "../../src/input/read-source";

const docxPath = "test/fixtures/conversion/java-vs-go.docx";

/** Returns the error readSource rejects with. Fails the test if it resolves. */
async function readError(source: unknown): Promise<DocchunkError> {
  try {
    await readSource(source);
  } catch (error) {
    if (error instanceof DocchunkError) {
      return error;
    }
    throw error;
  }
  throw new Error("readSource did not reject");
}

describe("readSource", () => {
  it("reads a file path into bytes, keeping the path as the file name", async () => {
    const loaded = await readSource({ path: docxPath });
    if (loaded.kind !== "bytes") {
      throw new Error("Expected bytes");
    }
    // readFile returns a Buffer, which is a Uint8Array; compare the contents, not the class.
    expect(new Uint8Array(loaded.bytes)).toEqual(new Uint8Array(readFileSync(docxPath)));
    expect(loaded.fileName).toBe(docxPath);
    expect(loaded.format).toBeUndefined();
    expect(loaded.path).toBe(docxPath);
  });

  it("passes bytes through with their optional file name and format", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const loaded = await readSource({ bytes, filename: "notes.md", format: "markdown" });
    expect(loaded).toEqual({
      kind: "bytes",
      bytes,
      fileName: "notes.md",
      format: "markdown",
      path: undefined,
    });
  });

  it("returns Markdown and text content as it is", async () => {
    const loaded = await readSource({ content: "# Title", format: "markdown" });
    expect(loaded).toEqual({ kind: "content", content: "# Title", format: "markdown" });
  });
});

describe("readSource errors", () => {
  it("rejects a missing file with FILE_NOT_FOUND", async () => {
    const error = await readError({ path: "test/fixtures/conversion/missing.pdf" });
    expect(error.code).toBe("FILE_NOT_FOUND");
    expect(error.message).toBe("File not found: test/fixtures/conversion/missing.pdf");
  });

  it("rejects a folder with FILE_NOT_FOUND", async () => {
    const error = await readError({ path: "test/fixtures" });
    expect(error.code).toBe("FILE_NOT_FOUND");
    expect(error.message).toBe("Path is a folder, not a file: test/fixtures");
  });

  it("rejects malformed sources with INVALID_OPTIONS", async () => {
    const cases: [unknown, string][] = [
      [null, "The source must be an object: { path }, { bytes }, or { content, format }."],
      [{ path: "" }, "The source's path must be a non-empty string."],
      [{ bytes: [1, 2, 3] }, "The source's bytes must be a Uint8Array."],
      [{ bytes: new Uint8Array(), filename: 5 }, "The source's filename must be a string."],
      [{ format: "markdown" }, "The source's content must be a string."],
    ];
    for (const [source, message] of cases) {
      const error = await readError(source);
      expect(error.code).toBe("INVALID_OPTIONS");
      expect(error.message).toBe(message);
    }
  });
});
