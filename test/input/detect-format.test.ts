// Checks detectFormatFromName: an explicit format first, then .md, .markdown, .txt, and .csv extensions.
import { describe, expect, it } from "vitest";
import { detectFormatFromName } from "../../src/input/detect-format";

describe("detectFormatFromName", () => {
  it("uses the explicit format before the file name", () => {
    expect(detectFormatFromName("pdf", "report.md")).toBe("pdf");
  });

  it("detects Markdown, text, and CSV from the extension, ignoring case", () => {
    expect(detectFormatFromName(undefined, "notes.md")).toBe("markdown");
    expect(detectFormatFromName(undefined, "NOTES.MARKDOWN")).toBe("markdown");
    expect(detectFormatFromName(undefined, "folder/readme.txt")).toBe("text");
    expect(detectFormatFromName(undefined, "data.CSV")).toBe("csv");
  });

  it("leaves other extensions to content detection", () => {
    expect(detectFormatFromName(undefined, "report.pdf")).toBeUndefined();
    expect(detectFormatFromName(undefined, "report")).toBeUndefined();
    expect(detectFormatFromName(undefined, undefined)).toBeUndefined();
  });

  it("rejects an explicit format docchunk cannot read with UNSUPPORTED_FORMAT", () => {
    for (const format of ["html", 5]) {
      expect(() => detectFormatFromName(format, undefined)).toThrow(
        expect.objectContaining({ code: "UNSUPPORTED_FORMAT" }),
      );
    }
    expect(() => detectFormatFromName("html", undefined)).toThrow(
      'Format "html" is not supported. Supported formats: pdf, docx, doc, pptx, ppt, xlsx, xls, odt, ods, odp, rtf, epub, csv, markdown, text.',
    );
  });
});
