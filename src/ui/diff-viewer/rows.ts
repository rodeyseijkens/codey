import {
  buildCanonicalDiffRows as buildRowsFromMetadata,
  type CanonicalDiffRow,
} from "../../patch/rows";
import { toInternalDiffFile } from "./model";
import type { DiffViewerFileInput } from "./types";

export type { CanonicalDiffRow } from "../../patch/rows";
// biome-ignore lint/performance/noBarrelFile: re-export from shared diff module
export { canonicalHunkOffsets, canonicalRowLabel } from "../../patch/rows";

export function buildCanonicalDiffRows(
  input: DiffViewerFileInput,
): CanonicalDiffRow[] {
  const { metadata } = toInternalDiffFile(input);
  return buildRowsFromMetadata(metadata);
}
