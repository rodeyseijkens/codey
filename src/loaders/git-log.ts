import type { CommitEntry, FileStatus } from "../types";
import { gitThrow } from "../vcs/git";

const LOG_FORMAT = "%H%n%s%n%an%n%ai%n";
const WHITESPACE_RE = /\s+/;

export async function gitLog(
  cwd: string,
  offset: number,
  limit: number
): Promise<{
  commits: CommitEntry[];
  hasMore: boolean;
  behind: number;
  ahead: number;
}> {
  const logOutput = await gitThrow(
    [
      "log",
      "--no-color",
      `--format=${LOG_FORMAT}`,
      `--skip=${offset}`,
      `-n${limit + 1}`,
    ],
    cwd
  );
  const parsed = parseLogOutput(logOutput);
  const hasMore = parsed.length > limit;
  const slice = hasMore ? parsed.slice(0, limit) : parsed;

  const { ahead, behind, unpushed } = await getPushedState(cwd);

  const filePromises = slice.map(async (c) => getCommitFiles(cwd, c.hash));
  const fileResults: Array<
    Array<{
      additions: number;
      deletions: number;
      path: string;
      status: FileStatus;
    }>
  > = await Promise.all(filePromises);

  const commits: CommitEntry[] = [];
  for (let i = 0; i < slice.length; i += 1) {
    const c = slice[i];
    if (!c) {
      continue;
    }
    const files = fileResults[i];
    if (!files) {
      continue;
    }
    const additions = files.reduce((sum, f) => sum + f.additions, 0);
    const deletions = files.reduce((sum, f) => sum + f.deletions, 0);
    commits.push({
      author: c.author,
      date: c.date,
      diffByPath: {},
      files,
      hash: c.hash,
      isPushed: !unpushed.has(c.hash),
      message: c.message,
      shortHash: c.shortHash,
      stats: { additions, deletions, files: files.length },
    });
  }

  return { ahead, behind, commits, hasMore };
}

function parseLogOutput(text: string): Array<{
  author: string;
  date: string;
  hash: string;
  message: string;
  shortHash: string;
}> {
  const out: Array<{
    author: string;
    date: string;
    hash: string;
    message: string;
    shortHash: string;
  }> = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const hash = lines[i]?.trim();
    if (!hash) {
      i += 1;
      continue;
    }
    out.push({
      author: lines[i + 2]?.trim() ?? "",
      date: lines[i + 3]?.trim() ?? "",
      hash,
      message: lines[i + 1]?.trim() ?? "",
      shortHash: hash.slice(0, 7),
    });
    i += 4;
  }
  return out;
}

/** Local-only (ahead) and remote-only (behind) commit counts for the current branch. */
export async function getBranchAheadBehind(
  cwd: string
): Promise<{ ahead: number; behind: number }> {
  try {
    const upstream = await gitThrow(["rev-parse", "--abbrev-ref", "@{u}"], cwd);
    const [behindStr, aheadStr] = (
      await gitThrow(
        ["rev-list", "--left-right", "--count", `${upstream.trim()}...HEAD`],
        cwd
      )
    )
      .trim()
      .split(WHITESPACE_RE);
    return {
      ahead: Number(aheadStr) || 0,
      behind: Number(behindStr) || 0,
    };
  } catch {
    return { ahead: 0, behind: 0 };
  }
}

async function getPushedState(
  cwd: string
): Promise<{ ahead: number; behind: number; unpushed: Set<string> }> {
  try {
    const upstream = await gitThrow(["rev-parse", "--abbrev-ref", "@{u}"], cwd);
    const base = upstream.trim();
    const out = await gitThrow(["rev-list", `${base}..HEAD`], cwd);
    const unpushed = new Set(out.split("\n").filter((h) => h.length > 0));
    const [behindStr] = (
      await gitThrow(
        ["rev-list", "--left-right", "--count", `${base}...HEAD`],
        cwd
      )
    )
      .trim()
      .split(WHITESPACE_RE);
    return {
      ahead: unpushed.size,
      behind: Number(behindStr) || 0,
      unpushed,
    };
  } catch {
    return { ahead: 0, behind: 0, unpushed: new Set() };
  }
}

async function getCommitFiles(
  cwd: string,
  hash: string
): Promise<
  Array<{
    additions: number;
    deletions: number;
    path: string;
    status: FileStatus;
  }>
> {
  try {
    const [nameStatus, numstat] = await Promise.all([
      gitThrow(["show", "--name-status", "--format=", "--no-color", hash], cwd),
      gitThrow(["show", "--numstat", "--format=", "--no-color", hash], cwd),
    ]);

    const numByPath = new Map<
      string,
      { additions: number; deletions: number }
    >();
    for (const line of numstat.split("\n")) {
      const parts = line.split("\t");
      if (parts.length >= 3) {
        const [addStr, delStr, ...rest] = parts;
        const path = rest.join("\t");
        if (path) {
          numByPath.set(path, {
            additions: Number(addStr) || 0,
            deletions: Number(delStr) || 0,
          });
        }
      }
    }

    const files: Array<{
      additions: number;
      deletions: number;
      path: string;
      status: FileStatus;
    }> = [];
    for (const line of nameStatus.split("\n")) {
      const parts = line.split("\t");
      const [code, ...rest] = parts;
      if (!code || rest.length === 0) {
        continue;
      }
      const path = rest.join("\t");
      const status = codeToStatus(code);
      const nums = numByPath.get(path);
      files.push({
        additions: nums?.additions ?? 0,
        deletions: nums?.deletions ?? 0,
        path,
        status,
      });
    }
    return files;
  } catch {
    return [];
  }
}

export async function getCommitFileDiff(
  cwd: string,
  hash: string,
  path: string
): Promise<string> {
  const out = await gitThrow(
    ["show", "--no-color", "--format=", hash, "--", path],
    cwd
  );
  return out;
}

function codeToStatus(code: string): FileStatus {
  switch (code[0]) {
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "T":
      return "type-changed";
    default:
      return "modified";
  }
}
