import { parsePatchFiles } from "@pierre/diffs";

import { normalizePatch } from "./patch/normalize";
import { buildCanonicalDiffRows, type CanonicalDiffRow } from "./rows";

export function diffRowsFromPatch(patchText: string): CanonicalDiffRow[] {
  if (!patchText) {
    return [];
  }
  const normalizedPatch = normalizePatch(patchText);
  const parsedPatches = parsePatchFiles(normalizedPatch.text, "patch", true);
  const [first] = parsedPatches;
  if (!first || first.files.length === 0) {
    return [];
  }
  const [meta] = first.files;
  if (!meta) {
    return [];
  }
  return buildCanonicalDiffRows(meta);
}
