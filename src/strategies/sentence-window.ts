// The sentence-window strategy: one chunk per sentence unit, with the units around it in the same section as context.
import { strategyDefaults } from "../config";
import type { DocumentIR, Unit } from "../ir/ir-types";
import { getSentenceUnits } from "../ir/sentence-units";
import { checkNonNegativeInteger } from "../options/option-checks";
import type { RawChunk, StrategyDefinition } from "./strategy-types";

export const sentenceWindowStrategy: StrategyDefinition<"sentence-window"> = {
  name: "sentence-window",
  defaults: strategyDefaults["sentence-window"],
  validate: (options) => {
    checkNonNegativeInteger("windowSize", options.windowSize);
  },
  split: (ir, options) => {
    const units = getSentenceUnits(ir);
    const sectionIds = unitSectionIds(ir, units);
    const rawChunks: RawChunk[] = [];
    for (const [unitIndex, unit] of units.entries()) {
      const firstIndex = windowEdge(sectionIds, unitIndex, -1, options.windowSize);
      const lastIndex = windowEdge(sectionIds, unitIndex, 1, options.windowSize);
      const contextStart = units[firstIndex]?.start ?? unit.start;
      const contextEnd = units[lastIndex]?.end ?? unit.end;
      rawChunks.push({
        start: unit.start,
        end: unit.end,
        context: { start: contextStart, end: contextEnd },
      });
    }
    return rawChunks;
  },
};

/** Returns the section id of each unit, taken from the block it belongs to. */
function unitSectionIds(ir: DocumentIR, units: Unit[]): number[] {
  const sectionIds: number[] = [];
  for (const unit of units) {
    sectionIds.push(ir.blocks[unit.blockIndex]?.sectionId ?? 0);
  }
  return sectionIds;
}

/** Returns the index of the farthest unit in one direction (-1 or 1), within windowSize steps and the same section. */
function windowEdge(
  sectionIds: number[],
  unitIndex: number,
  direction: -1 | 1,
  windowSize: number,
): number {
  const sectionId = sectionIds[unitIndex];
  let edgeIndex = unitIndex;
  for (let step = 1; step <= windowSize; step++) {
    const candidateIndex = unitIndex + direction * step;
    if (sectionIds[candidateIndex] !== sectionId) {
      break;
    }
    edgeIndex = candidateIndex;
  }
  return edgeIndex;
}
