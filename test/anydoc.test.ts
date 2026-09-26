// Checks that anydoc's native binary loads and converts a .docx on the current runtime.
import { readFileSync } from "node:fs";
import { toMarkdown, toMarkdownBytes } from "@firecrawl/anydoc";
import { describe, expect, it } from "vitest";

const docxPath = "test/fixtures/conversion/java-vs-go.docx";
const expectedTitle = "# Strategic Tech Stack Selection for Backend Career Transition";

describe("anydoc", () => {
  it("converts a .docx file path to Markdown", async () => {
    const markdown = await toMarkdown(docxPath);
    expect(markdown.startsWith(expectedTitle)).toBe(true);
  });

  it("converts .docx bytes to Markdown, detecting the format from the content", async () => {
    const bytes = readFileSync(docxPath);
    const markdown = await toMarkdownBytes(bytes);
    expect(markdown.startsWith(expectedTitle)).toBe(true);
  });
});
