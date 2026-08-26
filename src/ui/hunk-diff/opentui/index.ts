export {
  type FileDiffMetadata,
  parseDiffFromFile,
  parsePatchFiles,
} from "@pierre/diffs";

export { HunkDiffBody } from "./hunk-diff-body";
export {
  countHunkDiffStats,
  createHunkDiffFile,
  createHunkDiffFilesFromPatch,
} from "./model";
export {
  buildCanonicalDiffRows,
  type CanonicalDiffRow,
  canonicalHunkOffsets,
  canonicalRowLabel,
} from "./rows";
export type {
  HunkDiffBodyProps,
  HunkDiffFile,
  HunkDiffFileInput,
  HunkDiffLayout,
  HunkDiffNote,
  HunkDiffStats,
} from "./types";
