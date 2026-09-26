// Checks that sentence units follow PRD 5: sentences in prose, one unit per table or code block.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DocumentIR, Unit } from "../../src/ir/ir-types";
import { normalizeMarkdown } from "../../src/ir/normalize-markdown";
import { parseMarkdown } from "../../src/ir/parse-markdown";
import { getSentenceUnits } from "../../src/ir/sentence-units";

const defaultHeadingLevel = 3;

/** Builds the IR for a Markdown string. */
function buildIR(markdown: string): DocumentIR {
  return { markdown, blocks: parseMarkdown(markdown, defaultHeadingLevel) };
}

/** Builds the IR for a Markdown fixture. */
function buildFixtureIR(name: string): DocumentIR {
  const raw = readFileSync(`test/fixtures/markdown/${name}`, "utf8");
  return buildIR(normalizeMarkdown(raw));
}

/** Returns the Markdown text of each unit. */
function unitTexts(ir: DocumentIR, units: Unit[]): string[] {
  const texts: string[] = [];
  for (const unit of units) {
    texts.push(ir.markdown.slice(unit.start, unit.end));
  }
  return texts;
}

describe("getSentenceUnits", () => {
  it("splits a paragraph into sentences, ignoring line breaks inside a sentence", () => {
    const ir = buildIR("This sentence is wrapped\nacross two lines. This is the second one.");
    expect(unitTexts(ir, getSentenceUnits(ir))).toEqual([
      "This sentence is wrapped\nacross two lines.",
      "This is the second one.",
    ]);
  });

  it("gives every block type the units PRD 5 describes", () => {
    const ir = buildFixtureIR("mixed-blocks.md");
    const units = getSentenceUnits(ir);
    const summary = units.map((unit) => [unit.kind, ir.markdown.slice(unit.start, unit.end)]);
    expect(summary).toEqual([
      ["sentence", "A paragraph with **bold**, *italic*, and `code`."],
      ["sentence", "- First item"],
      ["sentence", "- Second item\n  - Nested item under the second item"],
      ["sentence", "- Third item"],
      ["sentence", "1. Ordered one"],
      ["sentence", "2. Ordered two"],
      ["table", "| Name | Role |\n|---|---|\n| Asha | Writer |\n| Kenji | Reviewer |"],
      ["code", '```ts\nconst greeting = "hello";\nconsole.log(greeting);\n```'],
      ["sentence", "> A blockquote."],
      ["sentence", "> It spans two lines."],
      ["sentence", "<div>An HTML block.</div>"],
      ["sentence", "Final paragraph."],
    ]);
  });

  it("records which block each unit came from", () => {
    const ir = buildFixtureIR("mixed-blocks.md");
    for (const unit of getSentenceUnits(ir)) {
      const block = ir.blocks[unit.blockIndex];
      expect(block).toBeDefined();
      expect(unit.start).toBeGreaterThanOrEqual(block?.start ?? Number.NaN);
      expect(unit.end).toBeLessThanOrEqual(block?.end ?? Number.NaN);
    }
  });

  it("splits Hindi, Japanese, and emoji text into sentences", () => {
    const ir = buildFixtureIR("multilingual.md");
    expect(unitTexts(ir, getSentenceUnits(ir))).toEqual([
      "भारत एक विशाल देश है।",
      "यहाँ कई भाषाएँ बोली जाती हैं।",
      "हर राज्य की अपनी संस्कृति है।",
      "लोग त्योहार मिलकर मनाते हैं।",
      "東京は日本の首都です。",
      "人口はとても多いです。",
      "電車は時間どおりに走ります。",
      "春には桜が咲きます。",
      "Families 👨‍👩‍👧‍👦 travel together.",
      "Flags 🇮🇳 🇯🇵 wave in the wind.",
      "Skin tones 👋🏽 and hearts ❤️ appear in messages.",
      "Every emoji here must stay whole when text is cut.",
    ]);
  });

  it("makes a paragraph without punctuation one unit", () => {
    const ir = buildFixtureIR("long-paragraph.md");
    const units = getSentenceUnits(ir);
    expect(units).toHaveLength(1);
    expect(units[0]?.end).toBe(ir.markdown.trimEnd().length);
  });

  it("returns no units for a document of headings only", () => {
    const ir = buildFixtureIR("headings-only.md");
    expect(getSentenceUnits(ir)).toEqual([]);
  });

  it("computes units once and stores them on the IR", () => {
    const ir = buildFixtureIR("nested-headings.md");
    expect(ir.sentenceUnits).toBeUndefined();
    const firstCall = getSentenceUnits(ir);
    expect(ir.sentenceUnits).toBe(firstCall);
    expect(getSentenceUnits(ir)).toBe(firstCall);
  });
});
