// End-to-end conversion tests (PRD 11, item 4): chunkDocument on every fixture format, from a path and from bytes.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  chunkDocument,
  DocchunkError,
  type DocumentFormat,
  type DocumentSource,
} from "../src/index";

const fixtureFolder = "test/fixtures/conversion";

/** Each fixture and the source format chunkDocument should report for it. */
const fixtures: [string, DocumentFormat][] = [
  ["java-vs-go.docx", "docx"],
  ["java-vs-go.epub", "epub"],
  ["java-vs-go.md", "markdown"],
  ["java-vs-go.txt", "text"],
  ["sample.odt", "odt"],
  ["sample.pptx", "pptx"],
  ["sample.rtf", "rtf"],
  ["sample.xls", "xls"],
  ["sample.xlsx", "xlsx"],
  ["survey.csv", "csv"],
  ["text.pdf", "pdf"],
];

describe("chunkDocument from a path, with default options", () => {
  for (const [fileName, sourceFormat] of fixtures) {
    it(`chunks ${fileName} as ${sourceFormat}`, async () => {
      const path = `${fixtureFolder}/${fileName}`;
      const result = await chunkDocument({ path });
      expect(result.document.sourceFormat).toBe(sourceFormat);
      expect(result.document.sourcePath).toBe(path);
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.warnings).toEqual([]);
    });
  }
});

describe("chunkDocument from bytes", () => {
  it("detects the format from the content, without a file name", async () => {
    const bytes = new Uint8Array(readFileSync(`${fixtureFolder}/java-vs-go.docx`));
    const result = await chunkDocument({ bytes });
    expect(result.document.sourceFormat).toBe("docx");
    expect(result.document.sourcePath).toBeUndefined();
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it("gives the same chunks as the path does", async () => {
    const path = `${fixtureFolder}/sample.pptx`;
    const fromPath = await chunkDocument({ path });
    const fromBytes = await chunkDocument({ bytes: new Uint8Array(readFileSync(path)) });
    expect(fromBytes.chunks).toEqual(fromPath.chunks);
  });

  it("reads Markdown and text bytes named by the file name or the format", async () => {
    const markdownBytes = new Uint8Array(readFileSync(`${fixtureFolder}/java-vs-go.md`));
    const byName = await chunkDocument({ bytes: markdownBytes, filename: "notes.md" });
    const byFormat = await chunkDocument({ bytes: markdownBytes, format: "markdown" });
    expect(byName.document.sourceFormat).toBe("markdown");
    expect(byFormat.chunks).toEqual(byName.chunks);
    const textResult = await chunkDocument({
      bytes: new TextEncoder().encode("# Not a heading"),
      format: "text",
    });
    expect(textResult.chunks[0]?.headingPath).toEqual([]);
  });

  it("treats a .txt file as plain text, so # is not a heading", async () => {
    const result = await chunkDocument({ path: `${fixtureFolder}/java-vs-go.txt` });
    expect(result.chunks.every((chunk) => chunk.headingPath.length === 0)).toBe(true);
  });
});

describe("chunkDocument on PDFs without a text layer", () => {
  it("returns no chunks and NO_TEXT_LAYER for a scanned PDF", async () => {
    const result = await chunkDocument({ path: `${fixtureFolder}/scanned.pdf` });
    expect(result.chunks).toEqual([]);
    expect(result.document.markdown).toBe("");
    expect(result.warnings.map((warning) => warning.code)).toEqual(["NO_TEXT_LAYER"]);
  });

  it("returns no chunks and NO_TEXT_LAYER for a PDF with under 100 characters, keeping its Markdown", async () => {
    const result = await chunkDocument({ path: `${fixtureFolder}/short-text.pdf` });
    expect(result.chunks).toEqual([]);
    expect(result.document.markdown).toContain("Page 1");
    expect(result.warnings.map((warning) => warning.code)).toEqual(["NO_TEXT_LAYER"]);
  });
});

describe("chunkDocument file errors", () => {
  /** Returns the error chunkDocument rejects with for the source. */
  async function chunkError(source: DocumentSource): Promise<DocchunkError> {
    try {
      await chunkDocument(source);
    } catch (error) {
      if (error instanceof DocchunkError) {
        return error;
      }
      throw error;
    }
    throw new Error("chunkDocument did not reject");
  }

  it("rejects a missing file with FILE_NOT_FOUND", async () => {
    expect((await chunkError({ path: `${fixtureFolder}/missing.docx` })).code).toBe(
      "FILE_NOT_FOUND",
    );
  });

  it("rejects a CSV without a name or format, and an unknown format, with UNSUPPORTED_FORMAT", async () => {
    const csvBytes = new Uint8Array(readFileSync(`${fixtureFolder}/survey.csv`));
    expect((await chunkError({ bytes: csvBytes })).code).toBe("UNSUPPORTED_FORMAT");
    // @ts-expect-error "html" is not a DocumentFormat; JavaScript callers can still pass it.
    expect((await chunkError({ bytes: csvBytes, format: "html" })).code).toBe("UNSUPPORTED_FORMAT");
  });

  it("rejects a damaged file with CONVERSION_FAILED", async () => {
    const truncated = new Uint8Array(readFileSync(`${fixtureFolder}/java-vs-go.docx`)).slice(
      0,
      2000,
    );
    expect((await chunkError({ bytes: truncated, filename: "broken.docx" })).code).toBe(
      "CONVERSION_FAILED",
    );
  });
});
