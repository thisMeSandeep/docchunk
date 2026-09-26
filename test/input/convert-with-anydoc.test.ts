// Checks convertWithAnydoc on every conversion fixture: format detection, Markdown, warnings, and errors.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DocchunkError } from "../../src/errors";
import { convertWithAnydoc } from "../../src/input/convert-with-anydoc";

/** Reads a conversion fixture's bytes. */
function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`test/fixtures/conversion/${name}`));
}

/** Returns the error convertWithAnydoc rejects with. Fails the test if it resolves. */
async function conversionError(
  bytes: Uint8Array,
  fileName: string | undefined,
): Promise<DocchunkError> {
  try {
    await convertWithAnydoc(bytes, undefined, fileName);
  } catch (error) {
    if (error instanceof DocchunkError) {
      return error;
    }
    throw error;
  }
  throw new Error("convertWithAnydoc did not reject");
}

describe("convertWithAnydoc", () => {
  const cases: [string, string, string][] = [
    ["java-vs-go.docx", "docx", "# Strategic Tech Stack Selection"],
    ["java-vs-go.epub", "epub", "Strategic Tech Stack Selection"],
    ["sample.pptx", "pptx", "## Discoverability and Analytics"],
    ["sample.xls", "xls", "| 0 | First Name | Last Name |"],
    ["sample.xlsx", "xlsx", "| Asha | Writer | 4 |"],
    ["sample.odt", "odt", "Fixture Document"],
    ["sample.rtf", "rtf", "Fixture Document"],
    ["text.pdf", "pdf", "Fixture Document"],
  ];

  for (const [fileName, expectedFormat, expectedText] of cases) {
    it(`detects ${fileName} as ${expectedFormat} from its content and converts it`, async () => {
      const conversion = await convertWithAnydoc(fixtureBytes(fileName), undefined, undefined);
      expect(conversion.sourceFormat).toBe(expectedFormat);
      expect(conversion.markdown).toContain(expectedText);
      expect(conversion.markdown.trim().length).toBeGreaterThan(0);
      expect(conversion.warnings).toEqual([]);
    });
  }

  it("converts CSV when the file name or format names it", async () => {
    const bytes = fixtureBytes("survey.csv");
    const byName = await convertWithAnydoc(bytes, undefined, "survey.csv");
    const byFormat = await convertWithAnydoc(bytes, "csv", undefined);
    expect(byName.sourceFormat).toBe("csv");
    expect(byName.markdown.startsWith("| ")).toBe(true);
    expect(byFormat.markdown).toBe(byName.markdown);
  });

  it("uses the given format as the source format", async () => {
    const conversion = await convertWithAnydoc(fixtureBytes("sample.xls"), "xls", undefined);
    expect(conversion.sourceFormat).toBe("xls");
  });
});

describe("convertWithAnydoc on PDFs without enough text", () => {
  it("returns no Markdown and NO_TEXT_LAYER, naming the pages, for a scanned PDF", async () => {
    const conversion = await convertWithAnydoc(fixtureBytes("scanned.pdf"), undefined, undefined);
    expect(conversion).toEqual({
      markdown: "",
      sourceFormat: "pdf",
      warnings: [
        {
          code: "NO_TEXT_LAYER",
          message:
            "This PDF appears to be scanned; OCR is not supported. Pages without a text layer: 1 of 1.",
        },
      ],
    });
  });

  it("warns NO_TEXT_LAYER for a PDF with fewer than 100 non-whitespace characters", async () => {
    const conversion = await convertWithAnydoc(
      fixtureBytes("short-text.pdf"),
      undefined,
      undefined,
    );
    expect(conversion.markdown).toContain("Page 1");
    expect(conversion.warnings.map((warning) => warning.code)).toEqual(["NO_TEXT_LAYER"]);
  });
});

describe("convertWithAnydoc errors", () => {
  it("rejects bytes with no recognizable format with UNSUPPORTED_FORMAT", async () => {
    const csvWithoutName = await conversionError(fixtureBytes("survey.csv"), undefined);
    expect(csvWithoutName.code).toBe("UNSUPPORTED_FORMAT");
    const unknown = await conversionError(new TextEncoder().encode("just some words"), "notes.xyz");
    expect(unknown.code).toBe("UNSUPPORTED_FORMAT");
  });

  it("rejects a damaged file with CONVERSION_FAILED, keeping anydoc's error as the cause", async () => {
    const truncated = fixtureBytes("java-vs-go.docx").slice(0, 2000);
    const error = await conversionError(truncated, "broken.docx");
    expect(error.code).toBe("CONVERSION_FAILED");
    expect(error.message.startsWith("Could not convert broken.docx:")).toBe(true);
    expect(error.cause).toBeInstanceOf(Error);
  });
});
