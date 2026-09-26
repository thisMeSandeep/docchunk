// Fails with exit code 1 if any file in src/ imports a network module or references fetch.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findNetworkUses } from "./find-network-uses";

const sourceDirectory = "src";

/** Returns the paths of all TypeScript files under the source directory. */
function listSourceFiles(): string[] {
  const relativePaths = readdirSync(sourceDirectory, { recursive: true, encoding: "utf8" });
  const sourceFiles: string[] = [];
  for (const relativePath of relativePaths) {
    if (relativePath.endsWith(".ts")) {
      sourceFiles.push(join(sourceDirectory, relativePath));
    }
  }
  return sourceFiles;
}

/** Prints every network use in src/ and returns how many were found. */
function reportNetworkUses(): number {
  let useCount = 0;
  for (const filePath of listSourceFiles()) {
    const sourceText = readFileSync(filePath, "utf8");
    for (const networkUse of findNetworkUses(sourceText)) {
      console.error(`${filePath}:${networkUse.lineNumber}: ${networkUse.line}`);
      useCount++;
    }
  }
  return useCount;
}

const useCount = reportNetworkUses();
if (useCount > 0) {
  console.error(
    `Found ${useCount} network use(s) in ${sourceDirectory}/. The library must not use the network.`,
  );
  process.exit(1);
}
console.log(`No network use found in ${sourceDirectory}/.`);
