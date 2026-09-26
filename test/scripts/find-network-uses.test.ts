// Checks that the network-use finder catches network imports and fetch, and nothing else.
import { describe, expect, it } from "vitest";
import { findNetworkUses } from "../../scripts/find-network-uses";

describe("findNetworkUses", () => {
  it("finds imports of network modules", () => {
    const sourceText = [
      'import http from "node:http";',
      "import { connect } from 'net';",
      'import * as tls from "node:tls";',
      'const https = await import("https");',
      'const net = require("node:net");',
    ].join("\n");
    const lineNumbers = findNetworkUses(sourceText).map((networkUse) => networkUse.lineNumber);
    expect(lineNumbers).toEqual([1, 2, 3, 4, 5]);
  });

  it("finds references to fetch", () => {
    const networkUses = findNetworkUses('const response = await fetch("https://example.com");');
    expect(networkUses).toEqual([
      { lineNumber: 1, line: 'const response = await fetch("https://example.com");' },
    ]);
  });

  it("ignores safe code", () => {
    const sourceText = [
      'import { createHash } from "node:crypto";',
      'import { readFile } from "node:fs/promises";',
      'const scheme = "http";',
      "const shouldPrefetch = false;",
    ].join("\n");
    expect(findNetworkUses(sourceText)).toEqual([]);
  });
});
