// Turns the caller's options into resolved options: strategy looked up, defaults filled in, every value checked.
import { strategyRegistry } from "../strategies/registry";
import type { ResolvedStrategyOptions } from "../strategies/strategy-types";
import type { StrategyName } from "../types";
import {
  checkUnknownOptions,
  type ResolvedCommonOptions,
  readCommonOptions,
  readOptionValues,
  readStrategyName,
} from "./validate-options";

/** Options with every default applied and every value checked. */
export interface ResolvedOptions<Name extends StrategyName = StrategyName>
  extends ResolvedCommonOptions {
  strategy: Name;
  strategyOptions: ResolvedStrategyOptions[Name];
}

/** Checks the caller's options and returns them with defaults applied. Throws INVALID_OPTIONS on a bad value. */
export function resolveOptions(options: unknown): ResolvedOptions {
  const optionValues = readOptionValues(options);
  const strategyName = readStrategyName(optionValues.get("strategy"));
  const strategyOptions = resolveStrategyOptions(strategyName, optionValues);
  const commonOptions = readCommonOptions(optionValues);
  return { strategy: strategyName, strategyOptions, ...commonOptions };
}

/** Returns the strategy's options with defaults filled in, after checking them with the strategy. */
function resolveStrategyOptions<Name extends StrategyName>(
  strategyName: Name,
  optionValues: Map<string, unknown>,
): ResolvedStrategyOptions[Name] {
  const definition = strategyRegistry[strategyName];
  const strategyOptionNames = Object.keys(definition.defaults);
  checkUnknownOptions(optionValues, strategyName, strategyOptionNames);
  const strategyOptions = fillDefaults(definition.defaults, optionValues);
  fitDefaultMinSize(strategyOptions, optionValues);
  definition.validate(strategyOptions);
  return strategyOptions;
}

/** Returns a copy of the defaults with every value the caller gave put in its place. */
function fillDefaults<Options extends object>(
  defaults: Options,
  optionValues: Map<string, unknown>,
): Options {
  const filled: Record<string, unknown> = {};
  for (const [optionName, defaultValue] of Object.entries(defaults)) {
    const givenValue = optionValues.get(optionName);
    filled[optionName] = givenValue === undefined ? defaultValue : givenValue;
  }
  // The caller's values are not typed yet; the strategy's validate function checks them right after.
  return filled as Options;
}

/** Lowers a default minSize to `size` when the caller set a smaller size but no minSize (DECISIONS 34). */
function fitDefaultMinSize(strategyOptions: object, optionValues: Map<string, unknown>): void {
  if (optionValues.get("minSize") !== undefined) {
    return;
  }
  const minSize: unknown = Reflect.get(strategyOptions, "minSize");
  const size: unknown = Reflect.get(strategyOptions, "size");
  if (typeof minSize === "number" && typeof size === "number" && minSize > size) {
    Reflect.set(strategyOptions, "minSize", size);
  }
}
