// Checks that normalizeMarkdown fixes line endings and removes the byte order mark.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeMarkdown } from "../../src/ir/normalize-markdown";

describe("normalizeMarkdown", () => {
  it("turns CRLF and lone CR into LF", () => {
    expect(normalizeMarkdown("one\r\ntwo\rthree\nfour")).toBe("one\ntwo\nthree\nfour");
  });

  it("removes a leading byte order mark", () => {
    expect(normalizeMarkdown("﻿# Title")).toBe("# Title");
  });

  it("keeps a byte order mark that is not at the start", () => {
    expect(normalizeMarkdown("a﻿b")).toBe("a﻿b");
  });

  it("leaves normalized text unchanged", () => {
    const text = "# Title\n\nParagraph with नमस्ते and 👋.\n";
    expect(normalizeMarkdown(text)).toBe(text);
  });

  it("normalizes the CRLF and BOM fixture", () => {
    const raw = readFileSync("test/fixtures/markdown/crlf-bom.md", "utf8");
    // Guards against git or an editor changing the fixture's bytes.
    expect(raw.startsWith("﻿")).toBe(true);
    expect(raw).toContain("\r\n");

    const normalized = normalizeMarkdown(raw);
    expect(normalized).toBe(
      "# Title\n\nFirst paragraph.\nSecond line of the first paragraph.\n\n- item one\n- item two\n",
    );
  });
});
