// Checks that resolveOptions fills in defaults and rejects bad options with INVALID_OPTIONS.
import { describe, expect, it } from "vitest";
import { DocchunkError } from "../../src/errors";
import { resolveOptions } from "../../src/options/resolve-options";

/** Returns the error resolveOptions throws for the options. Fails the test if it does not throw. */
function resolveError(options: unknown): DocchunkError {
  try {
    resolveOptions(options);
  } catch (error) {
    if (error instanceof DocchunkError) {
      return error;
    }
    throw error;
  }
  throw new Error("resolveOptions did not throw");
}

describe("resolveOptions", () => {
  it("fills in the strategy defaults and the common defaults", () => {
    expect(resolveOptions({ strategy: "fixed" })).toEqual({
      strategy: "fixed",
      strategyOptions: { size: 1500, boundary: "word" },
      metadata: {},
      documentId: undefined,
      headingPrefix: false,
      signal: undefined,
    });
  });

  it("keeps the values the caller gives", () => {
    const signal = new AbortController().signal;
    const resolved = resolveOptions({
      strategy: "fixed",
      size: 800,
      boundary: "char",
      metadata: { team: "legal" },
      documentId: "doc-1",
      headingPrefix: true,
      signal,
    });
    expect(resolved).toEqual({
      strategy: "fixed",
      strategyOptions: { size: 800, boundary: "char" },
      metadata: { team: "legal" },
      documentId: "doc-1",
      headingPrefix: true,
      signal,
    });
  });

  it("uses the default when a value is explicitly undefined", () => {
    const resolved = resolveOptions({ strategy: "fixed", size: undefined });
    expect(resolved.strategyOptions).toEqual({ size: 1500, boundary: "word" });
  });
});

describe("resolveOptions errors", () => {
  it("uses the INVALID_OPTIONS code", () => {
    expect(resolveError({ strategy: "fixed", size: 0 }).code).toBe("INVALID_OPTIONS");
  });

  it("requires a strategy until the default strategy exists", () => {
    expect(resolveError(undefined).message).toBe(
      'Option "strategy" is required. Use one of "fixed".',
    );
    expect(resolveError({}).message).toBe('Option "strategy" is required. Use one of "fixed".');
  });

  it("rejects an unknown strategy", () => {
    expect(resolveError({ strategy: "semantic" }).message).toBe(
      'Option "strategy" must be one of "fixed", got "semantic".',
    );
  });

  it("rejects options that are not an object", () => {
    expect(resolveError("fixed").message).toBe('Options must be an object, got "fixed".');
    expect(resolveError(null).message).toBe("Options must be an object, got null.");
    expect(resolveError(["fixed"]).message).toBe("Options must be an object, got an array.");
  });

  it("rejects an option that belongs to another strategy, naming it", () => {
    expect(resolveError({ strategy: "fixed", overlapChars: 200 }).message).toBe(
      'Unknown option "overlapChars" for strategy "fixed".',
    );
  });

  it("rejects bad strategy option values through the strategy's validate", () => {
    expect(resolveError({ strategy: "fixed", size: -1 }).message).toContain('Option "size"');
    expect(resolveError({ strategy: "fixed", boundary: "line" }).message).toContain(
      'Option "boundary"',
    );
  });

  it("rejects common options of the wrong type", () => {
    expect(resolveError({ strategy: "fixed", metadata: [1] }).message).toBe(
      'Option "metadata" must be an object, got an array.',
    );
    expect(resolveError({ strategy: "fixed", documentId: "" }).message).toBe(
      'Option "documentId" must be a non-empty string, got "".',
    );
    expect(resolveError({ strategy: "fixed", documentId: 42 }).message).toBe(
      'Option "documentId" must be a non-empty string, got 42.',
    );
    expect(resolveError({ strategy: "fixed", headingPrefix: "yes" }).message).toBe(
      'Option "headingPrefix" must be true or false, got "yes".',
    );
    expect(resolveError({ strategy: "fixed", signal: {} }).message).toBe(
      'Option "signal" must be an AbortSignal, got an object.',
    );
  });
});
