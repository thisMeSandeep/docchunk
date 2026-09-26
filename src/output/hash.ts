// Hashes text into short, stable ids for documents and chunks.
import { createHash } from "node:crypto";

const hashLength = 20;

/** Returns the first 20 hex characters of the SHA-256 hash of the text. */
export function hashText(text: string): string {
  const fullHash = createHash("sha256").update(text, "utf8").digest("hex");
  return fullHash.slice(0, hashLength);
}
