// The headingPrefix option: the text it adds to chunks, and the space it reserves within `size` (PRD 6.4).
import { DocchunkError } from "../errors";
import type { Block } from "../ir/ir-types";
import type { ResolvedStrategyOptions } from "../strategies/strategy-types";
import type { StrategyName } from "../types";
import { noSizeLimit } from "./option-checks";
import type { ResolvedOptions } from "./resolve-options";

/** Returns the text headingPrefix adds before a chunk: "A > B > C" and a blank line, or nothing for an empty path. */
export function headingPrefixText(headingPath: string[]): string {
  if (headingPath.length === 0) {
    return "";
  }
  return `${headingPath.join(" > ")}\n\n`;
}

/** Returns the strategy options to split with: `size` reduced by the longest heading prefix, so prefixed chunks still fit. */
export function reserveHeadingPrefixSpace<Name extends StrategyName>(
  options: ResolvedOptions<Name>,
  blocks: Block[],
): ResolvedStrategyOptions[Name] {
  if (!options.headingPrefix) {
    return options.strategyOptions;
  }
  let longestPrefix = 0;
  for (const block of blocks) {
    longestPrefix = Math.max(longestPrefix, headingPrefixText(block.headingPath).length);
  }
  if (longestPrefix === 0) {
    return options.strategyOptions;
  }
  return shrinkSizeOptions(options.strategyOptions, longestPrefix);
}

/** Options that are a maximum chunk size, and are reduced to make room for the prefix. */
const sizeOptionNames = ["size", "leafSize", "parentSize", "childSize"];

/** Returns a copy with every size option reduced, and minSize, step, and overlapChars kept within the new size. */
function shrinkSizeOptions<Options extends object>(
  strategyOptions: Options,
  reservedChars: number,
): Options {
  const shrunk: Record<string, unknown> = Object.fromEntries(Object.entries(strategyOptions));
  for (const optionName of sizeOptionNames) {
    const value = shrunk[optionName];
    if (typeof value === "number" && value !== noSizeLimit) {
      shrunk[optionName] = reduceSize(optionName, value, reservedChars);
    }
  }
  const levels = shrunk.levels;
  if (Array.isArray(levels)) {
    shrunk.levels = levels.map((level) => reduceSize("levels", Number(level), reservedChars));
  }
  const size = shrunk.size;
  if (typeof size === "number") {
    capOption(shrunk, "minSize", size);
    capOption(shrunk, "step", size);
    capOption(shrunk, "overlapChars", size - 1);
  }
  // Only number values that already passed validation were changed, so the shape is still Options.
  return shrunk as Options;
}

/** Returns the size minus the reserved characters. Throws if that leaves no room for any text. */
function reduceSize(optionName: string, size: number, reservedChars: number): number {
  const reducedSize = size - reservedChars;
  if (reducedSize < 1) {
    throw new DocchunkError(
      "INVALID_OPTIONS",
      `Option "headingPrefix" needs up to ${reservedChars} characters for heading paths, which leaves no room within "${optionName}" (${size}).`,
    );
  }
  return reducedSize;
}

/** Lowers a number option to `max` if it is larger. Leaves missing options alone. */
function capOption(options: Record<string, unknown>, optionName: string, max: number): void {
  const value = options[optionName];
  if (typeof value === "number" && value > max) {
    options[optionName] = max;
  }
}
