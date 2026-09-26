// Serializes resolved options into a stable string, used as part of every chunk id.
import type { ResolvedOptions } from "./resolve-options";

/** Returns the options as JSON with sorted keys. Leaves out metadata and signal, which do not affect chunks. */
export function canonicalOptions(options: ResolvedOptions): string {
  const optionsThatAffectChunks = {
    strategy: options.strategy,
    strategyOptions: options.strategyOptions,
    documentId: options.documentId,
    headingPrefix: options.headingPrefix,
  };
  return JSON.stringify(optionsThatAffectChunks, sortObjectKeys);
}

/** JSON.stringify replacer: returns objects with their keys in sorted order, and other values unchanged. */
function sortObjectKeys(_key: string, value: unknown): unknown {
  const isPlainObject = typeof value === "object" && value !== null && !Array.isArray(value);
  if (!isPlainObject) {
    return value;
  }
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(value).sort();
  for (const key of keys) {
    sorted[key] = Reflect.get(value, key);
  }
  return sorted;
}
