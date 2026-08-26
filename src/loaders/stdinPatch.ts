import type { StructuredPatch } from "diff";
import { formatPatch, parsePatch } from "diff";

import type { Changeset, FileDiff, FileStatus } from "../types";
import { DEFAULT_IGNORE_FILES, markIgnoredFiles } from "./ignore";
import {
  checkDiffLimits,
  countDiffLines,
  sectionIsBinary,
  sectionNewPath,
  sectionOldPath,
  splitDiffSections,
} from "./shared";

const NEW_FILE_MODE_RE = /^new file mode/m;
const DELETED_FILE_MODE_RE = /^deleted file mode/m;
const RENAME_RE = /^rename (from|to) /m;

function stripPrefix(path: string): string {
  if (path.startsWith("a/") || path.startsWith("b/")) {
    return path.slice(2);
  }
  return path;
}

function inferStatus(
  section: string,
  oldName: string | undefined,
  newName: string | undefined,
): FileStatus {
  if (NEW_FILE_MODE_RE.test(section)) {
    return "added";
  }
  if (DELETED_FILE_MODE_RE.test(section)) {
    return "deleted";
  }
  if (RENAME_RE.test(section)) {
    return "renamed";
  }
  if (oldName === "/dev/null") {
    return "added";
  }
  if (newName === "/dev/null") {
    return "deleted";
  }
  const oldStripped = oldName ? stripPrefix(oldName) : undefined;
  const newStripped = newName ? stripPrefix(newName) : undefined;
  if (oldStripped && newStripped && oldStripped !== newStripped) {
    return "renamed";
  }
  return "modified";
}

function buildPatchFile(section: string): FileDiff | null {
  let patches: StructuredPatch[];
  try {
    patches = parsePatch(section);
  } catch {
    return null;
  }
  const [patch] = patches;
  if (!patch) {
    return null;
  }
  const isBinary = sectionIsBinary(section);
  const newName = patch.newFileName ?? sectionNewPath(section);
  const oldName = patch.oldFileName ?? sectionOldPath(section);
  const path = newName ? stripPrefix(newName) : "";
  if (!path || path === "/dev/null") {
    return null;
  }
  const diff = isBinary ? "" : formatPatch(patch);
  const check = checkDiffLimits(diff);
  const oldStripped =
    oldName && oldName !== "/dev/null" ? stripPrefix(oldName) : undefined;
  const renamed = oldStripped !== undefined && oldStripped !== path;
  return {
    additions: isBinary ? 0 : countDiffLines(diff, "additions"),
    deletions: isBinary ? 0 : countDiffLines(diff, "deletions"),
    diff: check.tooLarge ? "" : diff,
    isBinary,
    notice: isBinary ? "binary file" : check.notice,
    oldPath: renamed ? oldStripped : undefined,
    path,
    status: inferStatus(section, oldName, newName),
    tooLarge: check.tooLarge,
  };
}

export async function stdinPatch(
  input?: string,
  ignoreFiles: readonly string[] = DEFAULT_IGNORE_FILES,
): Promise<Changeset> {
  const text = input ?? (await new Response(process.stdin).text());
  const rawSections = text.includes("diff --git ")
    ? splitDiffSections(text)
    : [text];
  const files: FileDiff[] = [];
  for (const section of rawSections) {
    if (!section.trim()) {
      continue;
    }
    const file = buildPatchFile(section);
    if (file) {
      files.push(file);
    }
  }
  markIgnoredFiles(files, ignoreFiles);
  return {
    files,
    id: "single",
    label: "patch",
    stats: (() => {
      let additions = 0;
      let deletions = 0;
      for (const file of files) {
        additions += file.additions;
        deletions += file.deletions;
      }
      return { additions, deletions, files: files.length };
    })(),
  };
}
