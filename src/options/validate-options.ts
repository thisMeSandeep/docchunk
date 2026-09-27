// Checks the caller's options before defaults are applied: the strategy name, unknown options, and common options.
import { defaultStrategy } from "../config";
import { DocchunkError } from "../errors";
import { strategyRegistry } from "../strategies/registry";
import type { StrategyName } from "../types";

/** Names of the options every strategy accepts. */
const commonOptionNames = ["metadata", "documentId", "headingPrefix", "signal"];

/** The common options, checked, with defaults applied. */
export interface ResolvedCommonOptions {
  metadata: Record<string, unknown>;
  documentId: string | undefined;
  headingPrefix: boolean;
  signal: AbortSignal | undefined;
}

/** Returns the options as a map from option name to value. Throws if they are not an object. */
export function readOptionValues(options: unknown): Map<string, unknown> {
  if (options === undefined) {
    return new Map();
  }
  if (!isRecord(options)) {
    throw invalidOptions(`Options must be an object, got ${describe(options)}.`);
  }
  const optionEntries: [string, unknown][] = Object.entries(options);
  return new Map(optionEntries);
}

/** Returns the strategy name, or the default strategy when none is given. Throws if it is not a registered strategy. */
export function readStrategyName(value: unknown): StrategyName {
  if (value === undefined) {
    return defaultStrategy;
  }
  if (!isStrategyName(value)) {
    const allowedList = Object.keys(strategyRegistry)
      .map((strategyName) => `"${strategyName}"`)
      .join(", ");
    throw invalidOptions(
      `Option "strategy" must be one of ${allowedList}, got ${describe(value)}.`,
    );
  }
  return value;
}

/** Throws if an option is neither a common option nor one of the strategy's options. */
export function checkUnknownOptions(
  optionValues: Map<string, unknown>,
  strategyName: StrategyName,
  strategyOptionNames: string[],
): void {
  for (const optionName of optionValues.keys()) {
    const isKnown =
      optionName === "strategy" ||
      commonOptionNames.includes(optionName) ||
      strategyOptionNames.includes(optionName);
    if (!isKnown) {
      throw invalidOptions(`Unknown option "${optionName}" for strategy "${strategyName}".`);
    }
  }
}

/** Returns the common options with defaults applied. Throws if a value has the wrong type. */
export function readCommonOptions(optionValues: Map<string, unknown>): ResolvedCommonOptions {
  const metadata = optionValues.get("metadata") ?? {};
  if (!isRecord(metadata)) {
    throw invalidOptions(`Option "metadata" must be an object, got ${describe(metadata)}.`);
  }
  const documentId = optionValues.get("documentId");
  const isValidDocumentId =
    documentId === undefined || (typeof documentId === "string" && documentId !== "");
  if (!isValidDocumentId) {
    throw invalidOptions(
      `Option "documentId" must be a non-empty string, got ${describe(documentId)}.`,
    );
  }
  const headingPrefix = optionValues.get("headingPrefix") ?? false;
  if (typeof headingPrefix !== "boolean") {
    throw invalidOptions(
      `Option "headingPrefix" must be true or false, got ${describe(headingPrefix)}.`,
    );
  }
  const signal = optionValues.get("signal");
  if (signal !== undefined && !(signal instanceof AbortSignal)) {
    throw invalidOptions(`Option "signal" must be an AbortSignal, got ${describe(signal)}.`);
  }
  return { metadata, documentId, headingPrefix, signal };
}

/** Returns true when the value is a registered strategy name. */
function isStrategyName(value: unknown): value is StrategyName {
  return typeof value === "string" && Object.hasOwn(strategyRegistry, value);
}

/** Returns true when the value is an object that is not null or an array. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns a short description of a value for error messages. */
function describe(value: unknown): string {
  if (Array.isArray(value)) {
    return "an array";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "object") {
    return "an object";
  }
  return String(value);
}

/** Creates an INVALID_OPTIONS error. */
function invalidOptions(message: string): DocchunkError {
  return new DocchunkError("INVALID_OPTIONS", message);
}
