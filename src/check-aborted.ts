// Stops work when the caller's AbortSignal has been aborted.
import { DocchunkError } from "./errors";

/** Throws ABORTED when the signal is aborted, with the signal's reason as the cause. Does nothing without a signal. */
export function checkAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new DocchunkError("ABORTED", "Chunking was aborted.", { cause: signal.reason });
  }
}
