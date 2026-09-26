// Benchmarks chunking speed and memory for the PRD 9 targets. Run with `bun run bench` (Bun) or `bun run bench:node` (Node).
import { existsSync, readFileSync } from "node:fs";
import { Bench } from "tinybench";
import { type ChunkOptions, chunkDocument, type StrategyName } from "../src/index";
import { normalizeMarkdown } from "../src/ir/normalize-markdown";
import { parseMarkdown } from "../src/ir/parse-markdown";

const oneMegabyte = 1_000_000;
const sampleCsvPath =
  "sample-test-files/annual-enterprise-survey-2025-financial-year-provisional-size-bands.csv";

/** Returns about 1 MB of prose: the Java vs Go fixture repeated. */
function proseMarkdown(): string {
  const article = readFileSync("test/fixtures/conversion/java-vs-go.md", "utf8");
  const copies: string[] = [];
  let length = 0;
  while (length < oneMegabyte) {
    copies.push(article);
    length += article.length + 2;
  }
  return normalizeMarkdown(copies.join("\n\n"));
}

/** Returns about 1 MB of one Markdown table, like a converted spreadsheet. */
function tableMarkdown(): string {
  const rows = ["| Id | Name | Region | Amount | Status |", "|---|---|---|---|---|"];
  let length = 0;
  for (let rowNumber = 1; length < oneMegabyte; rowNumber++) {
    const row = `| ${rowNumber} | Customer ${rowNumber} | Region ${rowNumber % 17} | ${rowNumber * 37} | active |`;
    rows.push(row);
    length += row.length + 1;
  }
  return rows.join("\n");
}

/** Returns the sample CSV converted to Markdown, or undefined when sample-test-files/ is not present. */
async function sampleCsvMarkdown(): Promise<string | undefined> {
  if (!existsSync(sampleCsvPath)) {
    return undefined;
  }
  const result = await chunkDocument({ path: sampleCsvPath }, { strategy: "fixed" });
  return result.document.markdown;
}

/** Chunks Markdown content with the options. Conversion is not part of this, as PRD 9 asks. */
async function chunkMarkdown(markdown: string, options?: ChunkOptions): Promise<void> {
  await chunkDocument({ content: markdown, format: "markdown" }, options);
}

/** Runs the benchmark tasks and prints milliseconds per run and per MB. */
async function runSpeedBenchmarks(
  prose: string,
  table: string,
  sampleCsv: string | undefined,
): Promise<void> {
  const bench = new Bench({ time: 2000, iterations: 3, warmupIterations: 1 });
  const sizeByTask = new Map<string, number>();
  const addTask = (name: string, size: number, task: () => unknown): void => {
    sizeByTask.set(name, size);
    bench.add(name, task);
  };
  addTask("parse only, 1 MB prose", prose.length, () => parseMarkdown(prose, 3));
  addTask("structure (default), 1 MB prose", prose.length, () => chunkMarkdown(prose));
  addTask("structure (default), 1 MB table", table.length, () => chunkMarkdown(table));
  const otherStrategies: StrategyName[] = [
    "sentence",
    "paragraph",
    "heading",
    "sentence-window",
    "parent-child",
    "hierarchical",
    "fixed",
    "fixed-overlap",
    "recursive",
    "sliding-window",
  ];
  for (const strategy of otherStrategies) {
    addTask(`${strategy}, 1 MB prose`, prose.length, () => chunkMarkdown(prose, { strategy }));
  }
  if (sampleCsv !== undefined) {
    const megabytes = (sampleCsv.length / oneMegabyte).toFixed(1);
    addTask(`structure (default), sample CSV ${megabytes} MB`, sampleCsv.length, () =>
      chunkMarkdown(sampleCsv),
    );
  }
  await bench.run();
  for (const task of bench.tasks) {
    const result = task.result;
    const size = sizeByTask.get(task.name) ?? oneMegabyte;
    if (result.state !== "completed") {
      console.log(`${task.name}: ${result.state}`);
      continue;
    }
    const meanMs = result.latency.mean;
    const msPerMegabyte = (meanMs * oneMegabyte) / size;
    console.log(
      `${task.name.padEnd(42)} ${meanMs.toFixed(0).padStart(6)} ms   ${msPerMegabyte.toFixed(0).padStart(6)} ms/MB`,
    );
  }
}

/** True when running on Bun, which reports some process numbers differently from Node. */
const isBun = typeof Reflect.get(globalThis, "Bun") === "object";

/** Returns the most memory the process has used so far, in bytes. */
function peakMemoryBytes(): number {
  // Node reports maxRSS in kilobytes; Bun on macOS passes the operating system's bytes through.
  const maxRss = process.resourceUsage().maxRSS;
  return isBun ? maxRss : maxRss * 1024;
}

/** Measures how much the process's peak memory grows while the default strategy chunks 1 MB of prose. */
async function runMemoryBenchmark(prose: string): Promise<void> {
  const inputBytes = new TextEncoder().encode(prose).length;
  // The peak only rises, so this runs first, before other benchmarks raise it.
  const peakBefore = peakMemoryBytes();
  const result = await chunkDocument({ content: prose, format: "markdown" });
  const peakGrowth = peakMemoryBytes() - peakBefore;
  const growthMegabytes = (peakGrowth / oneMegabyte).toFixed(0);
  console.log(
    `memory, structure on 1 MB prose (${result.chunks.length} chunks): peak grew ${growthMegabytes} MB = ${(peakGrowth / inputBytes).toFixed(1)}x the input`,
  );
}

console.log(`docchunk benchmarks on ${isBun ? "Bun" : `Node ${process.version}`}\n`);
const prose = proseMarkdown();
await runMemoryBenchmark(prose);
console.log("");
const table = tableMarkdown();
const sampleCsv = await sampleCsvMarkdown();
await runSpeedBenchmarks(prose, table, sampleCsv);
