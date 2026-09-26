// Reads a Markdown node's position as a range of offsets.
import type { Nodes } from "mdast";
import type { Range } from "./ir-types";

/** Returns the start and end offsets of a node in the Markdown. */
export function nodeRange(node: Nodes): Range {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) {
    throw new Error(`The Markdown parser returned a ${node.type} node without offsets.`);
  }
  return { start, end };
}
