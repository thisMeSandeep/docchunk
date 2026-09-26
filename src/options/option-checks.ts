// Checks for single option values. Each throws INVALID_OPTIONS with a message naming the option.
import { DocchunkError } from "../errors";

/** Throws unless the value is an integer greater than 0. */
export function checkPositiveInteger(optionName: string, value: unknown): void {
  const isPositiveInteger = Number.isInteger(value) && Number(value) > 0;
  if (!isPositiveInteger) {
    throw new DocchunkError(
      "INVALID_OPTIONS",
      `Option "${optionName}" must be a positive integer, got ${String(value)}.`,
    );
  }
}

/** Throws unless the value is an integer of 0 or more. */
export function checkNonNegativeInteger(optionName: string, value: unknown): void {
  const isNonNegativeInteger = Number.isInteger(value) && Number(value) >= 0;
  if (!isNonNegativeInteger) {
    throw new DocchunkError(
      "INVALID_OPTIONS",
      `Option "${optionName}" must be an integer of 0 or more, got ${String(value)}.`,
    );
  }
}

/** Throws unless one option is smaller than another: for example overlapChars < size. */
export function checkLessThan(
  optionName: string,
  value: number,
  limitName: string,
  limit: number,
): void {
  if (value >= limit) {
    throw new DocchunkError(
      "INVALID_OPTIONS",
      `Option "${optionName}" must be less than "${limitName}" (${limit}), got ${value}.`,
    );
  }
}

/** Throws unless one option is at most another: for example step <= size. */
export function checkAtMost(
  optionName: string,
  value: number,
  limitName: string,
  limit: number,
): void {
  if (value > limit) {
    throw new DocchunkError(
      "INVALID_OPTIONS",
      `Option "${optionName}" must be at most "${limitName}" (${limit}), got ${value}.`,
    );
  }
}

/** Throws unless the value is one of the allowed values. */
export function checkOneOf(optionName: string, value: unknown, allowedValues: string[]): void {
  const isAllowed = typeof value === "string" && allowedValues.includes(value);
  if (!isAllowed) {
    const allowedList = allowedValues.map((allowedValue) => `"${allowedValue}"`).join(", ");
    throw new DocchunkError(
      "INVALID_OPTIONS",
      `Option "${optionName}" must be one of ${allowedList}, got ${String(value)}.`,
    );
  }
}
