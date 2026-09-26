// Checks that Markdown and text input never load anydoc (PRD 5: "anydoc is loaded on first use").
import { describe, expect, it, vi } from "vitest";
import { chunkDocument, DocchunkError } from "../src/index";

// Any import of anydoc in this test file's modules runs this factory, which fails loudly.
vi.mock("@firecrawl/anydoc", () => {
  throw new Error("anydoc was loaded");
});

describe("anydoc loading", () => {
  it("does not load anydoc for Markdown or text files, bytes, or content", async () => {
    await chunkDocument({ path: "test/fixtures/conversion/java-vs-go.md" });
    await chunkDocument({ path: "test/fixtures/conversion/java-vs-go.txt" });
    await chunkDocument({ bytes: new TextEncoder().encode("# Title"), format: "markdown" });
    await chunkDocument({ content: "# Title", format: "markdown" });
  });

  it("does load anydoc for a docx, which shows the mock is in effect", async () => {
    const reject = chunkDocument({ path: "test/fixtures/conversion/java-vs-go.docx" });
    await expect(reject).rejects.toThrow(DocchunkError);
    await expect(reject).rejects.toThrow("The anydoc converter could not be loaded");
  });
});
