import { resolve } from "node:path";
import type { BunFile } from "bun";
import { createTwoFilesPatch } from "diff";

import type { Changeset, FileDiff } from "../types";
import { MAX_DIFF_BYTES } from "../types";
import { git, gitThrow } from "../vcs/git";
import { DEFAULT_IGNORE_FILES, markIgnoredFiles } from "./ignore";
import {
  buildGitChangeset,
  checkDiffLimits,
  countDiffLines,
  type SizeCheck,
} from "./shared";

async function isGitRef(rev: string, cwd: string): Promise<boolean> {
  const res = await git(
    ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`],
    cwd,
  );
  return res.exitCode === 0;
}

async function twoFileDiff(
  a: string,
  b: string,
  cwd: string,
  ignoreFiles: readonly string[],
): Promise<Changeset> {
  const base = ["diff", "--no-color", "-M", a, b];
  const [nameStatus, numstat, diffText] = await Promise.all([
    gitThrow([...base.slice(0, -2), "--name-status", a, b], cwd),
    gitThrow([...base.slice(0, -2), "--numstat", a, b], cwd),
    gitThrow(base, cwd),
  ]);
  return buildGitChangeset({
    diffText,
    id: "single",
    ignoreFiles,
    label: `diff ${a}..${b}`,
    nameStatus,
    numstat,
  });
}

async function readOrThrow(rel: string, cwd: string): Promise<BunFile> {
  const file = Bun.file(resolve(cwd, rel));
  if (!(await file.exists())) {
    throw new Error(`no such file: ${rel}`);
  }
  return file;
}

function fileNotice(check: SizeCheck, isBinary: boolean): string | undefined {
  if (check.tooLarge) {
    return check.notice;
  }
  if (isBinary) {
    return "binary file";
  }
}

async function twoFilePath(
  a: string,
  b: string,
  cwd: string,
  ignoreFiles: readonly string[],
): Promise<Changeset> {
  const label = `diff ${a}..${b}`;
  const [fileA, fileB] = await Promise.all([
    readOrThrow(a, cwd),
    readOrThrow(b, cwd),
  ]);
  let file: FileDiff | null;
  if (fileA.size > MAX_DIFF_BYTES || fileB.size > MAX_DIFF_BYTES) {
    file = {
      additions: 0,
      deletions: 0,
      diff: "",
      isBinary: false,
      notice: "file too large",
      oldPath: a,
      path: b,
      status: "modified",
      tooLarge: true,
    };
  } else {
    const [textA, textB] = await Promise.all([fileA.text(), fileB.text()]);
    const isBinary = textA.includes("\0") || textB.includes("\0");
    const diff = isBinary ? "" : createTwoFilesPatch(a, b, textA, textB);
    const check = checkDiffLimits(diff);
    file = {
      additions: isBinary ? 0 : countDiffLines(diff, "additions"),
      deletions: isBinary ? 0 : countDiffLines(diff, "deletions"),
      diff: check.tooLarge ? "" : diff,
      isBinary,
      notice: fileNotice(check, isBinary),
      oldPath: a,
      path: b,
      status: "modified",
      tooLarge: check.tooLarge,
    };
  }
  const files: FileDiff[] = [];
  if (file) {
    files.push(file);
  }
  markIgnoredFiles(files, ignoreFiles);
  return {
    files,
    id: "single",
    label,
    stats: (() => {
      let additions = 0;
      let deletions = 0;
      for (const f of files) {
        additions += f.additions;
        deletions += f.deletions;
      }
      return { additions, deletions, files: files.length };
    })(),
  };
}

export async function twoFile(
  a: string,
  b: string,
  cwd: string,
  ignoreFiles: readonly string[] = DEFAULT_IGNORE_FILES,
): Promise<Changeset> {
  const [refA, refB] = await Promise.all([isGitRef(a, cwd), isGitRef(b, cwd)]);
  if (refA && refB) {
    return twoFileDiff(a, b, cwd, ignoreFiles);
  }
  return twoFilePath(a, b, cwd, ignoreFiles);
}
