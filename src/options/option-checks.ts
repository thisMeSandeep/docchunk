// Checks for single option values. Each throws INVALID_OPTIONS with a message naming the option.
import { DocchunkError } from "../errors";

/** The resolved `size` of strategies whose default is "no size limit". Every size check passes against it. */
export const noSizeLimit = Number.POSITIVE_INFINITY;

/** Throws unless the value is a positive integer, or the "no size limit" default. */
export function checkSizeOrNoLimit(optionName: string, value: unknown): void {
  if (value !== noSizeLimit) {
    checkPositiveInteger(optionName, value);
  }
}

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

/** Throws unless the value is an integer from `min` to `max`, inclusive. */
export function checkIntegerBetween(
  optionName: string,
  value: unknown,
  min: number,
  max: number,
): void {
  const isInRange = Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
  if (!isInRange) {
    throw new DocchunkError(
      "INVALID_OPTIONS",
      `Option "${optionName}" must be an integer from ${min} to ${max}, got ${String(value)}.`,
    );
  }
}

/** Throws unless the value is a non-empty array of positive integers, each smaller than the one before. */
export function checkDecreasingSizes(optionName: string, value: unknown): void {
  let isValid = Array.isArray(value) && value.length > 0;
  let previous = Number.POSITIVE_INFINITY;
  for (const item of Array.isArray(value) ? value : []) {
    const isPositiveInteger = Number.isInteger(item) && Number(item) > 0;
    if (!isPositiveInteger || Number(item) >= previous) {
      isValid = false;
    }
    previous = Number(item);
  }
  if (!isValid) {
    throw new DocchunkError(
      "INVALID_OPTIONS",
      `Option "${optionName}" must be a non-empty array of positive integers, each smaller than the one before, got ${JSON.stringify(value)}.`,
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

/** Throws unless the value is an array of non-empty strings. */
export function checkNonEmptyStrings(optionName: string, value: unknown): void {
  const isArray = Array.isArray(value);
  let hasOnlyNonEmptyStrings = isArray;
  if (isArray) {
    for (const item of value) {
      if (typeof item !== "string" || item === "") {
        hasOnlyNonEmptyStrings = false;
      }
    }
  }
  if (!hasOnlyNonEmptyStrings) {
    throw new DocchunkError(
      "INVALID_OPTIONS",
      `Option "${optionName}" must be an array of non-empty strings, got ${JSON.stringify(value)}.`,
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
