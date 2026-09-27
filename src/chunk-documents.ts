// chunkDocuments: chunks several documents, a few at a time. One failed document does not stop the others.
import { checkAborted } from "./check-aborted";
import { chunkWithResolvedOptions } from "./chunk-document";
import { defaultConcurrency } from "./config";
import { DocchunkError } from "./errors";
import { checkPositiveInteger } from "./options/option-checks";
import { type ResolvedOptions, resolveOptions } from "./options/resolve-options";
import type { BatchItem, ChunkOptions, DocumentSource } from "./types";

/** Options for chunkDocuments: the options for every document, plus how many to chunk at once. */
export type BatchOptions = ChunkOptions & {
  /** Documents chunked at the same time. Default 4. */
  concurrency?: number;
};

/** Chunks several documents; one failed document does not stop the others. Items are in the same order as the sources. */
export async function chunkDocuments(
  sources: DocumentSource[],
  options?: BatchOptions,
): Promise<BatchItem[]> {
  if (!Array.isArray(sources)) {
    throw new DocchunkError("INVALID_OPTIONS", "The sources must be an array.");
  }
  const optionValues = new Map<string, unknown>(Object.entries(options ?? {}));
  const concurrency = optionValues.get("concurrency") ?? defaultConcurrency;
  checkPositiveInteger("concurrency", concurrency);
  optionValues.delete("concurrency");
  // Options are checked once, so a bad option fails the whole call instead of every document.
  const resolvedOptions = resolveOptions(Object.fromEntries(optionValues));
  checkAborted(resolvedOptions.signal);

  const items: BatchItem[] = [];
  let nextSourceIndex = 0;
  /** Takes the next source from the queue until none are left. Several workers run at once. */
  const runWorker = async (): Promise<void> => {
    while (nextSourceIndex < sources.length) {
      // Without this, a batch of content strings never lets timers run, so a timeout could not abort it.
      await yieldToEventLoop();
      checkAborted(resolvedOptions.signal);
      // Another worker may have taken the last source while this one waited.
      if (nextSourceIndex >= sources.length) {
        break;
      }
      const sourceIndex = nextSourceIndex;
      nextSourceIndex++;
      items[sourceIndex] = await chunkOneSource(sources[sourceIndex], sourceIndex, resolvedOptions);
    }
  };
  const workers: Promise<void>[] = [];
  const workerCount = Math.min(Number(concurrency), sources.length);
  for (let workerNumber = 0; workerNumber < workerCount; workerNumber++) {
    workers.push(runWorker());
  }
  await Promise.all(workers);
  return items;
}

/** Returns one batch item: the result, or the error the document failed with. An abort stops the whole batch. */
async function chunkOneSource(
  source: unknown,
  sourceIndex: number,
  resolvedOptions: ResolvedOptions,
): Promise<BatchItem> {
  try {
    const result = await chunkWithResolvedOptions(source, resolvedOptions);
    return { ok: true, result };
  } catch (error) {
    if (error instanceof DocchunkError && error.code === "ABORTED") {
      throw error;
    }
    return { ok: false, error: asDocchunkError(error, sourceIndex), sourceIndex };
  }
}

/** Returns the error as a DocchunkError. An unexpected error is wrapped, so a batch item always has an error code. */
function asDocchunkError(error: unknown, sourceIndex: number): DocchunkError {
  if (error instanceof DocchunkError) {
    return error;
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new DocchunkError(
    "CONVERSION_FAILED",
    `Unexpected error while chunking source ${sourceIndex}: ${detail}`,
    { cause: error },
  );
}

/** Returns a promise that resolves once pending timers and I/O callbacks have had a turn. */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}
