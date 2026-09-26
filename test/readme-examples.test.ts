// Runs every ```ts example in README.md against the source code, so the README cannot drift from the library.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

/** Where the examples are written as modules while the tests run. The folder is gitignored and removed after. */
const exampleFolder = resolve("test/.readme-examples");

/** README file names, mapped to fixtures that exist, so the examples run unchanged apart from the paths. */
const fixtureByFileName = new Map([
  ['"report.pdf"', '"test/fixtures/conversion/text.pdf"'],
  ['"manual.docx"', '"test/fixtures/conversion/java-vs-go.docx"'],
  ['"policy.pdf"', '"test/fixtures/conversion/text.pdf"'],
  ['"a.docx"', '"test/fixtures/conversion/java-vs-go.docx"'],
  ['"b.pdf"', '"test/fixtures/conversion/text.pdf"'],
  ['"notes.md"', '"test/fixtures/conversion/java-vs-go.md"'],
]);

/** Returns the code of every ```ts block in the README. */
function readmeExamples(): string[] {
  const readme = readFileSync("README.md", "utf8");
  const examples: string[] = [];
  for (const match of readme.matchAll(/```ts\n([\s\S]*?)```/g)) {
    examples.push(match[1] ?? "");
  }
  return examples;
}

/** Returns the example with "docchunk" imported from the source and file names replaced by fixtures. */
function runnableExample(example: string): string {
  const sourceEntry = pathToFileURL(resolve("src/index.ts")).href;
  let code = example.replaceAll('from "docchunk"', `from "${sourceEntry}"`);
  for (const [fileName, fixturePath] of fixtureByFileName) {
    code = code.replaceAll(fileName, fixturePath);
  }
  return code;
}

describe("README examples", () => {
  const examples = readmeExamples();
  mkdirSync(exampleFolder, { recursive: true });
  afterAll(() => rmSync(exampleFolder, { recursive: true, force: true }));

  it("has the examples from PRD 8", () => {
    expect(examples.length).toBeGreaterThanOrEqual(5);
  });

  for (const [index, example] of examples.entries()) {
    it(`runs example ${index + 1} without errors`, async () => {
      const examplePath = resolve(exampleFolder, `example-${index + 1}.ts`);
      writeFileSync(examplePath, runnableExample(example));
      await import(pathToFileURL(examplePath).href);
    });
  }
});
