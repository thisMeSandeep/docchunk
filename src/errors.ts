// Defines DocchunkError, the one error type the library throws.

/** What went wrong, as a stable code callers can check. */
export type DocchunkErrorCode =
  | "INVALID_OPTIONS"
  | "UNSUPPORTED_FORMAT"
  | "CONVERSION_FAILED"
  | "FILE_NOT_FOUND"
  | "ABORTED";

/** Error thrown by docchunk. Check `code` to see what went wrong. */
export class DocchunkError extends Error {
  /** What went wrong. */
  readonly code: DocchunkErrorCode;

  /** Creates an error with a code, a message, and optionally the error that caused it. */
  constructor(code: DocchunkErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DocchunkError";
    this.code = code;
  }
}
