// Checks that chunkDocuments never runs more than `concurrency` documents at the same time.
import { describe, expect, it, vi } from "vitest";
import { chunkDocuments } from "../src/index";

const tracker = { running: 0, mostAtOnce: 0 };

// Wraps the per-document function to count how many documents run at once. Each one waits briefly so runs overlap.
vi.mock("../src/chunk-document", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/chunk-document")>();
  return {
    ...original,
    chunkWithResolvedOptions: async (
      ...args: Parameters<typeof original.chunkWithResolvedOptions>
    ) => {
      tracker.running++;
      tracker.mostAtOnce = Math.max(tracker.mostAtOnce, tracker.running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      try {
        return await original.chunkWithResolvedOptions(...args);
      } finally {
        tracker.running--;
      }
    },
  };
});

/** Returns 10 small Markdown sources. */
function tenSources() {
  return Array.from({ length: 10 }, (_, index) => ({
    content: `Document ${index}.`,
    format: "markdown" as const,
  }));
}

describe("chunkDocuments concurrency", () => {
  it("runs at most `concurrency` documents at once, and uses all of them", async () => {
    for (const concurrency of [1, 3]) {
      tracker.mostAtOnce = 0;
      const items = await chunkDocuments(tenSources(), { concurrency });
      expect(items).toHaveLength(10);
      expect(tracker.mostAtOnce).toBe(concurrency);
    }
  });

  it("runs 4 documents at once by default", async () => {
    tracker.mostAtOnce = 0;
    await chunkDocuments(tenSources());
    expect(tracker.mostAtOnce).toBe(4);
  });
});
