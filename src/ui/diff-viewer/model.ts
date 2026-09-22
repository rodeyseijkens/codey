import { parsePatchFiles } from "@pierre/diffs";

import { normalizePatch } from "../../patch/patch/normalize";
import {
  buildCanonicalDiffRows as buildRowsFromMetadata,
  type CanonicalDiffRow,
} from "../../patch/rows";

export type { CanonicalDiffRow } from "../../patch/rows";

import { patchLooksBinary } from "./render/binary";
import { findPatchChunk, splitPatchIntoFileChunks } from "./render/chunks";
import { countDiffStats } from "./render/diffFile";
import {
  normalizeDiffMetadataPaths,
  normalizeDiffPath,
} from "./render/diffPaths";
import type { DiffFile } from "./render/types";
import type { DiffViewerFile, DiffViewerFileInput } from "./types";

const NORMALIZED_DIFF_VIEWER_FILES = new WeakSet<DiffViewerFile>();

/** Count visible additions and deletions from Pierre metadata. */
export const countDiffViewerStats = countDiffStats;

/** Build one public file while optionally preserving paths decoded exactly from Git quoting. */
function buildDiffViewerFile(
  input: DiffViewerFileInput,
  pathsAreExact: boolean,
): DiffViewerFile {
  const metadata = pathsAreExact
    ? input.metadata
    : normalizeDiffMetadataPaths(input.metadata);
  const path = pathsAreExact
    ? (input.path ?? metadata.name)
    : (normalizeDiffPath(input.path) ?? metadata.name);
  const previousPath = pathsAreExact
    ? (input.previousPath ?? metadata.prevName)
    : (normalizeDiffPath(input.previousPath) ?? metadata.prevName);
  const normalized = {
    ...input,
    canonicalRows:
      input.canonicalRows ??
      buildRowsFromMetadata(metadata, input.newLineCount),
    id: input.id,
    metadata,
    path,
    previousPath,
    stats: input.stats ?? countDiffViewerStats(metadata),
  } satisfies DiffViewerFile;

  NORMALIZED_DIFF_VIEWER_FILES.add(normalized);
  return normalized;
}

/** Build Hunk's public OpenTUI file model with normalized paths and default stats. */
export function createDiffViewerFile(
  input: DiffViewerFileInput,
): DiffViewerFile {
  return buildDiffViewerFile(input, false);
}

/** Return an already-normalized public file as-is, or normalize a raw input shape. */
function resolveDiffViewerFile(input: DiffViewerFileInput) {
  if (NORMALIZED_DIFF_VIEWER_FILES.has(input as DiffViewerFile)) {
    return input as DiffViewerFile;
  }

  return createDiffViewerFile(input);
}

/** Adapt the public OpenTUI file shape into Hunk's internal review file model. */
export function toInternalDiffFile(diff: DiffViewerFileInput): DiffFile {
  const normalized = resolveDiffViewerFile(diff);
  const patch = normalized.patch ?? "";

  return {
    agent: null,
    id: normalized.id,
    isBinary: normalized.isBinary ?? patchLooksBinary(patch),
    isTooLarge: normalized.isTooLarge,
    isUntracked: normalized.isUntracked,
    language: normalized.language,
    metadata: normalized.metadata,
    newLineCount: normalized.newLineCount,
    patch,
    path: normalized.path ?? normalized.metadata.name,
    previousPath: normalized.previousPath,
    stats: normalized.stats,
    statsTruncated: normalized.statsTruncated,
  };
}

/** Parse unified diff text into Hunk's public OpenTUI file model.
 *  The most recent parse is memoized so repeat calls for the same patch
 *  (DiffPane render, row counts, clamping) share one parse per open. */
let lastFilesFromPatch:
  | { cacheKey: string; files: DiffViewerFile[] }
  | undefined;

export function createDiffViewerFilesFromPatch(
  patchText: string,
  sourceId = "patch",
  newLineCount?: number,
) {
  const cacheKey = `${sourceId}\u0000${newLineCount ?? ""}\u0000${patchText}`;
  if (lastFilesFromPatch?.cacheKey === cacheKey) {
    return lastFilesFromPatch.files;
  }

  const normalizedPatch = normalizePatch(patchText);
  const chunks = splitPatchIntoFileChunks(normalizedPatch.text);

  const files = parsePatchFiles(normalizedPatch.text, sourceId, true)
    .flatMap((entry) => entry.files)
    .map((metadata, index) => {
      const decodedPaths = normalizedPatch.filePaths[index];
      const normalizedMetadata = decodedPaths
        ? {
            ...metadata,
            name: decodedPaths.path,
            prevName: decodedPaths.previousPath,
          }
        : metadata;

      return buildDiffViewerFile(
        {
          id: `${sourceId}:${index}:${normalizedMetadata.name}`,
          metadata: normalizedMetadata,
          newLineCount,
          patch: findPatchChunk(metadata, chunks, index),
        },
        Boolean(decodedPaths),
      );
    });

  lastFilesFromPatch = { cacheKey, files };
  return files;
}

/** Build canonical diff rows from a public OpenTUI file input, reusing the cached rows. */
export function buildCanonicalDiffRows(
  input: DiffViewerFileInput,
): CanonicalDiffRow[] {
  const normalized = resolveDiffViewerFile(input);
  return normalized.canonicalRows ?? [];
}

/** Adapt a list of public OpenTUI files into Hunk's internal review file model. */
export function toInternalDiffFiles(files: DiffViewerFileInput[]) {
  return files.map(toInternalDiffFile);
}
