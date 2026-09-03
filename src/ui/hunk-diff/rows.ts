import {
  buildCanonicalDiffRows as buildRowsFromMetadata,
  type CanonicalDiffRow,
} from "../../diff/rows";
import { toInternalDiffFile } from "./model";
import type { HunkDiffFileInput } from "./types";

export type { CanonicalDiffRow } from "../../diff/rows";
// biome-ignore lint/performance/noBarrelFile: re-export from shared diff module
export { canonicalHunkOffsets, canonicalRowLabel } from "../../diff/rows";

export function buildCanonicalDiffRows(
  input: HunkDiffFileInput,
): CanonicalDiffRow[] {
  const { metadata } = toInternalDiffFile(input);
  return buildRowsFromMetadata(metadata);
}
