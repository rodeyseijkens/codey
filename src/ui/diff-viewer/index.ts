// biome-ignore lint/performance/noBarrelFile: intentional re-export hub
export {
  type FileDiffMetadata,
  parseDiffFromFile,
  parsePatchFiles,
} from "@pierre/diffs";

export { DiffBody } from "./diff-body";
export {
  countDiffViewerStats,
  createDiffViewerFile,
  createDiffViewerFilesFromPatch,
} from "./model";
export {
  buildCanonicalDiffRows,
  type CanonicalDiffRow,
  canonicalHunkOffsets,
  canonicalRowLabel,
} from "./rows";
export type {
  DiffBodyProps,
  DiffLayout,
  DiffNote,
  DiffStats,
  DiffViewerFile,
  DiffViewerFileInput,
} from "./types";
