// Checks DocchunkError's code, message, name, and cause.
import { describe, expect, it } from "vitest";
import { DocchunkError } from "../src/index";

describe("DocchunkError", () => {
  it("carries a code and a message", () => {
    const error = new DocchunkError("INVALID_OPTIONS", "size must be a positive integer");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DocchunkError);
    expect(error.code).toBe("INVALID_OPTIONS");
    expect(error.message).toBe("size must be a positive integer");
    expect(error.name).toBe("DocchunkError");
  });

  it("keeps the error that caused it", () => {
    const cause = new Error("anydoc: malformed");
    const error = new DocchunkError("CONVERSION_FAILED", "Could not convert report.docx", {
      cause,
    });
    expect(error.cause).toBe(cause);
  });
});
