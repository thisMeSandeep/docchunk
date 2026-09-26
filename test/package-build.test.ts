// Builds the package and uses both builds the way users do: require() for CJS, import() for ESM (DECISIONS 6).
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

type PublicApi = typeof import("../src/index");

const require = createRequire(import.meta.url);
const distFolder = resolve("dist");

describe("the built package", () => {
  beforeAll(() => {
    execFileSync(resolve("node_modules/.bin/tsup"), { stdio: "pipe" });
  }, 120_000);

  it("works through require() of the CJS build, including ESM-only dependencies and anydoc", async () => {
    // require() returns an untyped module; the published types describe it.
    const api: PublicApi = require(resolve(distFolder, "index.cjs"));
    const markdown = await api.chunkDocument({ content: "# Title\n\nText.", format: "markdown" });
    expect(markdown.chunks[0]?.headingPath).toEqual(["Title"]);
    const docx = await api.chunkDocument({ path: "test/fixtures/conversion/java-vs-go.docx" });
    expect(docx.document.sourceFormat).toBe("docx");
    expect(docx.chunks.length).toBeGreaterThan(0);
  });

  it("works through import() of the ESM build", async () => {
    const api: PublicApi = await import(pathToFileURL(resolve(distFolder, "index.js")).href);
    const items = await api.chunkDocuments([
      { content: "One.", format: "text" },
      { path: "test/fixtures/conversion/sample.rtf" },
    ]);
    expect(items.map((item) => item.ok)).toEqual([true, true]);
    expect(typeof api.buildChunkTree).toBe("function");
    expect(new api.DocchunkError("ABORTED", "stop").code).toBe("ABORTED");
  });
});
