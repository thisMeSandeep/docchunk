// Checks that hashText returns the first 20 hex characters of SHA-256.
import { describe, expect, it } from "vitest";
import { hashText } from "../../src/output/hash";

describe("hashText", () => {
  it("matches known SHA-256 values", () => {
    expect(hashText("abc")).toBe("ba7816bf8f01cfea4141");
    expect(hashText("")).toBe("e3b0c44298fc1c149afb");
  });

  it("returns 20 lowercase hex characters", () => {
    expect(hashText("Any chunk text")).toMatch(/^[0-9a-f]{20}$/);
  });

  it("hashes non-Latin text and emoji as UTF-8", () => {
    // Expected value from: printf 'नमस्ते 👋' | shasum -a 256
    expect(hashText("नमस्ते 👋")).toBe("5076aa20569058038508");
  });
});
