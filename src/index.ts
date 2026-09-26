// Public API of docchunk.
export { buildChunkTree } from "./build-chunk-tree";
export { chunkDocument } from "./chunk-document";
export { type BatchOptions, chunkDocuments } from "./chunk-documents";
export { DocchunkError, type DocchunkErrorCode } from "./errors";
export type {
  BatchItem,
  BytesSource,
  Chunk,
  ChunkOptions,
  ChunkResult,
  ChunkStats,
  ChunkTreeNode,
  ChunkWarning,
  ChunkWarningCode,
  CommonOptions,
  ContentSource,
  DocumentFormat,
  DocumentInfo,
  DocumentSource,
  PathSource,
  StrategyName,
  StrategyOptionsByName,
} from "./types";
