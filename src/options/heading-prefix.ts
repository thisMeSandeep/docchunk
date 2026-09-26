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

/** Returns a copy with `size` reduced, and minSize, step, and overlapChars kept within the new size. */
function shrinkSizeOptions<Options extends object>(
  strategyOptions: Options,
  reservedChars: number,
): Options {
  const size: unknown = Reflect.get(strategyOptions, "size");
  if (typeof size !== "number" || size === noSizeLimit) {
    return strategyOptions;
  }
  const reducedSize = size - reservedChars;
  if (reducedSize < 1) {
    throw new DocchunkError(
      "INVALID_OPTIONS",
      `Option "headingPrefix" needs up to ${reservedChars} characters for heading paths, which leaves no room within "size" (${size}).`,
    );
  }
  const shrunk: Record<string, unknown> = { ...strategyOptions, size: reducedSize };
  capOption(shrunk, "minSize", reducedSize);
  capOption(shrunk, "step", reducedSize);
  capOption(shrunk, "overlapChars", reducedSize - 1);
  // Only number values that already passed validation were changed, so the shape is still Options.
  return shrunk as Options;
}

/** Lowers a number option to `max` if it is larger. Leaves missing options alone. */
function capOption(options: Record<string, unknown>, optionName: string, max: number): void {
  const value = options[optionName];
  if (typeof value === "number" && value > max) {
    options[optionName] = max;
  }
}
