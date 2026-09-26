// buildChunkTree: rebuilds the nested parent/child structure from a flat chunk list.
import type { Chunk, ChunkTreeNode } from "./types";

/** Returns the chunks as a tree: chunks without a parent in the list are roots, children keep their list order. */
export function buildChunkTree(chunks: Chunk[]): ChunkTreeNode[] {
  const nodeById = new Map<string, ChunkTreeNode>();
  for (const chunk of chunks) {
    nodeById.set(chunk.id, { chunk, children: [] });
  }
  const roots: ChunkTreeNode[] = [];
  for (const chunk of chunks) {
    const node = nodeById.get(chunk.id);
    if (node === undefined) {
      continue;
    }
    const parent = chunk.parentId === undefined ? undefined : nodeById.get(chunk.parentId);
    // A chunk whose parent is not in the list, for example after filtering, becomes a root.
    if (parent === undefined) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }
  return roots;
}
