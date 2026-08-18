// biome-ignore lint/style/useFilenamingConvention: spec requires this filename
import { join } from "node:path";
import { createTwoFilesPatch } from "diff";
import type { Changeset, FileDiff } from "../types";
import { MAX_DIFF_BYTES } from "../types";
import { gitThrow } from "../vcs/git";
import { DEFAULT_IGNORE_FILES, markIgnoredFiles } from "./ignore";
import { buildGitChangeset, checkDiffLimits, countDiffLines } from "./shared";

const SEPARATOR_RE = /^=+$/;

function createUntrackedPatch(rel: string, content: string): string {
  const raw = createTwoFilesPatch("/dev/null", rel, "", content);
  const lines = raw
    .split("\n")
    .filter((line) => !(line.startsWith("Index: ") || SEPARATOR_RE.test(line)));
  return lines
    .map((line) => (line.startsWith(`+++ ${rel}`) ? `+++ b/${rel}` : line))
    .join("\n");
}

function comparePaths(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

async function buildUntrackedFile(cwd: string, rel: string): Promise<FileDiff> {
  const file = Bun.file(join(cwd, rel));
  if (file.size > MAX_DIFF_BYTES) {
    return {
      additions: 0,
      deletions: 0,
      diff: "",
      isBinary: false,
      notice: `file too large (${file.size} bytes)`,
      path: rel,
      status: "added",
      tooLarge: true,
    };
  }
  const content = await file.text();
  if (content.includes("\0")) {
    return {
      additions: 0,
      deletions: 0,
      diff: "",
      isBinary: true,
      notice: "binary file",
      path: rel,
      status: "added",
      tooLarge: false,
    };
  }
  const diff = createUntrackedPatch(rel, content);
  const check = checkDiffLimits(diff);
  if (check.tooLarge) {
    return {
      additions: 0,
      deletions: 0,
      diff: "",
      isBinary: false,
      notice: check.notice,
      path: rel,
      status: "added",
      tooLarge: true,
    };
  }
  return {
    additions: countDiffLines(diff, "additions"),
    deletions: 0,
    diff,
    isBinary: false,
    path: rel,
    status: "added",
    tooLarge: false,
  };
}

export async function gitUnstaged(
  cwd: string,
  ignoreFiles: readonly string[] = DEFAULT_IGNORE_FILES
): Promise<Changeset> {
  const base = ["diff", "--no-color", "-M", "-U999999"];
  const [nameStatus, numstat, diffText, untrackedText] = await Promise.all([
    gitThrow([...base, "--name-status"], cwd),
    gitThrow([...base, "--numstat"], cwd),
    gitThrow(base, cwd),
    gitThrow(["ls-files", "--others", "--exclude-standard"], cwd),
  ]);
  const changeset = buildGitChangeset({
    diffText,
    id: "changes",
    ignoreFiles,
    label: "Changes",
    nameStatus,
    numstat,
  });
  const untrackedFiles = await Promise.all(
    untrackedText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((rel) => buildUntrackedFile(cwd, rel))
  );
  markIgnoredFiles(untrackedFiles, ignoreFiles);
  const files = [...changeset.files, ...untrackedFiles].sort((a, b) =>
    comparePaths(a.path, b.path)
  );
  return {
    ...changeset,
    files,
    stats: {
      additions: files.reduce((sum, file) => sum + file.additions, 0),
      deletions: files.reduce((sum, file) => sum + file.deletions, 0),
      files: files.length,
    },
  };
}
