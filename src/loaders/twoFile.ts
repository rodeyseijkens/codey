// biome-ignore lint/style/useFilenamingConvention: spec requires this filename
import { resolve } from "node:path";
import type { BunFile } from "bun";
import { createTwoFilesPatch } from "diff";
import type { Changeset, FileDiff } from "../types";
import { MAX_DIFF_BYTES } from "../types";
import { git, gitThrow } from "../vcs/git";
import {
  buildGitChangeset,
  checkDiffLimits,
  countDiffLines,
  type SizeCheck,
} from "./shared";

async function isGitRef(rev: string, cwd: string): Promise<boolean> {
  const res = await git(
    ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`],
    cwd
  );
  return res.exitCode === 0;
}

async function twoFileDiff(
  a: string,
  b: string,
  cwd: string
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
  cwd: string
): Promise<Changeset> {
  const label = `diff ${a}..${b}`;
  const [fileA, fileB] = await Promise.all([
    readOrThrow(a, cwd),
    readOrThrow(b, cwd),
  ]);
  if (fileA.size > MAX_DIFF_BYTES || fileB.size > MAX_DIFF_BYTES) {
    const file: FileDiff = {
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
    return {
      files: [file],
      id: "single",
      label,
      stats: { additions: 0, deletions: 0, files: 1 },
    };
  }
  const [textA, textB] = await Promise.all([fileA.text(), fileB.text()]);
  const isBinary = textA.includes("\0") || textB.includes("\0");
  const diff = isBinary ? "" : createTwoFilesPatch(a, b, textA, textB);
  const check = checkDiffLimits(diff);
  const file: FileDiff = {
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
  return {
    files: [file],
    id: "single",
    label,
    stats: {
      additions: file.additions,
      deletions: file.deletions,
      files: 1,
    },
  };
}

export async function twoFile(
  a: string,
  b: string,
  cwd: string
): Promise<Changeset> {
  const [refA, refB] = await Promise.all([isGitRef(a, cwd), isGitRef(b, cwd)]);
  if (refA && refB) {
    return twoFileDiff(a, b, cwd);
  }
  return twoFilePath(a, b, cwd);
}
