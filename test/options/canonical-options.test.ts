// Checks that canonicalOptions is stable, sorted, and ignores metadata and signal.
import { describe, expect, it } from "vitest";
import { canonicalOptions } from "../../src/options/canonical-options";
import { resolveOptions } from "../../src/options/resolve-options";

describe("canonicalOptions", () => {
  it("serializes resolved options as JSON with sorted keys", () => {
    const resolved = resolveOptions({ strategy: "fixed", documentId: "doc-1" });
    expect(canonicalOptions(resolved)).toBe(
      '{"documentId":"doc-1","headingPrefix":false,"strategy":"fixed","strategyOptions":{"boundary":"word","size":1500}}',
    );
  });

  it("does not depend on the order the caller wrote the options in", () => {
    const first = resolveOptions({ strategy: "fixed", size: 900, boundary: "char" });
    const second = resolveOptions({ boundary: "char", size: 900, strategy: "fixed" });
    expect(canonicalOptions(first)).toBe(canonicalOptions(second));
  });

  it("is the same whether an option is left out or set to its default", () => {
    const leftOut = resolveOptions({ strategy: "fixed" });
    const setToDefault = resolveOptions({ strategy: "fixed", size: 1500, boundary: "word" });
    expect(canonicalOptions(leftOut)).toBe(canonicalOptions(setToDefault));
  });

  it("ignores metadata and signal", () => {
    const plain = resolveOptions({ strategy: "fixed" });
    const withExtras = resolveOptions({
      strategy: "fixed",
      metadata: { team: "legal" },
      signal: new AbortController().signal,
    });
    expect(canonicalOptions(withExtras)).toBe(canonicalOptions(plain));
  });

  it("changes when an option that affects chunks changes", () => {
    const small = resolveOptions({ strategy: "fixed", size: 500 });
    const large = resolveOptions({ strategy: "fixed", size: 1000 });
    const prefixed = resolveOptions({ strategy: "fixed", headingPrefix: true });
    const plain = resolveOptions({ strategy: "fixed" });
    expect(canonicalOptions(small)).not.toBe(canonicalOptions(large));
    expect(canonicalOptions(prefixed)).not.toBe(canonicalOptions(plain));
  });
});
