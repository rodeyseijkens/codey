import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type GitResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export class GitError extends Error {
  readonly stderr: string;
  readonly exitCode: number;

  constructor(
    message: string,
    stderr: string,
    exitCode: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GitError";
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

export async function git(args: string[], cwd: string): Promise<GitResult> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stderr, stdout };
}

export async function gitThrow(args: string[], cwd: string): Promise<string> {
  const res = await git(args, cwd);
  if (res.exitCode !== 0) {
    const detail = res.stderr.trim() || res.stdout.trim();
    throw new GitError(
      `git ${args.join(" ")} failed: ${detail}`,
      res.stderr,
      res.exitCode,
    );
  }
  return res.stdout;
}

export async function isRepo(cwd: string): Promise<boolean> {
  const res = await git(["rev-parse", "--is-inside-work-tree"], cwd);
  return res.exitCode === 0 && res.stdout.trim() === "true";
}

export async function getRepoRoot(cwd: string): Promise<string> {
  return (await gitThrow(["rev-parse", "--show-toplevel"], cwd)).trim();
}

export async function getGitDir(root: string): Promise<string> {
  const out = (
    await gitThrow(["rev-parse", "--absolute-git-dir"], root)
  ).trim();
  return out;
}

export async function currentBranch(root: string): Promise<string> {
  const res = await git(["symbolic-ref", "--quiet", "--short", "HEAD"], root);
  if (res.exitCode === 0 && res.stdout.trim()) {
    return res.stdout.trim();
  }
  const sha = await git(["rev-parse", "--short", "HEAD"], root);
  if (sha.exitCode === 0 && sha.stdout.trim()) {
    return `${sha.stdout.trim()} (detached)`;
  }
  return "(no commits)";
}

export type ConflictState = {
  busy: boolean;
  cherryPicking: boolean;
  merging: boolean;
  rebasing: boolean;
};

export async function detectConflicts(gitDir: string): Promise<ConflictState> {
  const [merge, cherry, rebaseMerge, rebaseApply] = await Promise.all([
    Bun.file(`${gitDir}/MERGE_HEAD`).exists(),
    Bun.file(`${gitDir}/CHERRY_PICK_HEAD`).exists(),
    Bun.file(`${gitDir}/rebase-merge`).exists(),
    Bun.file(`${gitDir}/rebase-apply`).exists(),
  ]);
  const rebasing = rebaseMerge || rebaseApply;
  return {
    busy: merge || cherry || rebasing,
    cherryPicking: cherry,
    merging: merge,
    rebasing,
  };
}

export async function hasHead(root: string): Promise<boolean> {
  const res = await git(["rev-parse", "--verify", "HEAD"], root);
  return res.exitCode === 0;
}

export async function stageFiles(root: string, paths: string[]): Promise<void> {
  if (paths.length === 0) {
    return;
  }
  await gitThrow(["add", "--", ...paths], root);
}

export async function unstageFiles(
  root: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) {
    return;
  }
  const restore = await git(["restore", "--staged", "--", ...paths], root);
  if (restore.exitCode === 0) {
    return;
  }
  const fallbackArgs = (await hasHead(root))
    ? ["reset", "HEAD", "--", ...paths]
    : ["rm", "--cached", "--", ...paths];
  await gitThrow(fallbackArgs, root);
}

export async function restoreWorktreeFiles(
  root: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) {
    return;
  }
  await gitThrow(["restore", "--worktree", "--", ...paths], root);
}

export async function deleteFiles(
  root: string,
  paths: string[],
): Promise<void> {
  await Promise.all(paths.map((rel) => Bun.file(join(root, rel)).delete()));
}

export async function resetCommit(
  root: string,
  mode: "mixed" | "soft" | "hard",
  hash: string,
): Promise<void> {
  await gitThrow(["reset", `--${mode}`, hash], root);
}

export async function editCommit(
  root: string,
  action: "squash" | "fixup" | "drop" | "amend",
  hash: string,
): Promise<void> {
  if (action === "amend") {
    await gitThrow(["commit", "--amend", "--no-edit"], root);
    return;
  }
  if (action === "drop") {
    await gitThrow(["rebase", "--onto", `${hash}^`, hash], root);
    return;
  }
  const shortHash = hash.slice(0, 7);
  let base: string;
  let sequenceEditor: string;
  try {
    await gitThrow(["rev-parse", "--verify", `${hash}~2`], root);
    base = `${hash}~2`;
    sequenceEditor = `sed -i '2s/^pick/${action}/'`;
  } catch {
    base = "--root";
    sequenceEditor = `sed -i '/^pick .*${shortHash}/s/^pick/${action}/'`;
  }
  await rebaseWithSequenceEditor(root, base, sequenceEditor);
}

async function rebaseWithSequenceEditor(
  root: string,
  base: string,
  sequenceEditor: string,
  extraEnv: Record<string, string> = {},
): Promise<void> {
  const proc = Bun.spawn(["git", "rebase", "-i", base], {
    cwd: root,
    env: {
      ...process.env,
      ...extraEnv,
      GIT_SEQUENCE_EDITOR: sequenceEditor,
      GIT_TERMINAL_PROMPT: "0",
    },
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new GitError(
      `git rebase failed: ${stderr.trim() || stdout.trim()}`,
      stderr,
      exitCode,
    );
  }
}

export async function reorderCommit(
  root: string,
  olderHash: string,
): Promise<void> {
  await withRebaseStash(root, "reorder", () =>
    rebaseWithSequenceEditor(root, `${olderHash}^`, `sed -i '1{h;d};2{G}'`),
  );
}

/**
 * Run a history-rewriting rebase with the working tree stashed, restoring it
 * afterwards. Keeps uncommitted review changes from blocking the rebase.
 */
async function withRebaseStash(
  root: string,
  op: "reorder" | "reword",
  fn: () => Promise<void>,
): Promise<void> {
  const label = `${op}-rebase-stash`;
  const stashesBefore = await gitThrow(["stash", "list"], root);
  await gitThrow(["stash", "push", "-m", label], root);
  const stashesAfter = await gitThrow(["stash", "list"], root);
  const stashed = stashesAfter !== stashesBefore;
  try {
    await fn();
  } catch (e) {
    if (stashed) {
      try {
        await gitThrow(["stash", "apply"], root);
      } catch (applyErr) {
        gitThrow(["stash", "drop"], root).catch(() => undefined);
        throw new GitError(
          `${op} rebase failed and stash apply conflicted — stash preserved as '${label}'`,
          "",
          1,
          { cause: applyErr },
        );
      }
      await gitThrow(["stash", "drop"], root).catch(() => undefined);
    }
    throw e;
  }
  if (stashed) {
    try {
      await gitThrow(["stash", "apply"], root);
      await gitThrow(["stash", "drop"], root);
    } catch (applyErr) {
      throw new GitError(
        `${op} rebase succeeded but stash apply conflicted — stash preserved as '${label}'`,
        "",
        1,
        { cause: applyErr },
      );
    }
  }
}

export async function rewordCommit(
  root: string,
  hash: string,
  message: string,
): Promise<void> {
  const head = (await gitThrow(["rev-parse", "HEAD"], root)).trim();
  if (hash === head) {
    await gitThrow(["commit", "--amend", "--only", "-m", message], root);
    return;
  }
  await rewordCommitInHistory(root, hash, message);
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/**
 * Reword a non-HEAD commit by replaying `hash^..HEAD` with the target marked
 * `reword`. The commit message is supplied through a temp file so arbitrary
 * text (quotes, newlines) survives shell interpolation.
 */
async function rewordCommitInHistory(
  root: string,
  hash: string,
  message: string,
): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "codey-reword-"));
  const messagePath = join(dir, "message");
  writeFileSync(messagePath, message, "utf8");
  const base = (await hasParent(root, hash)) ? `${hash}^` : "--root";
  try {
    await withRebaseStash(root, "reword", () =>
      rebaseWithSequenceEditor(root, base, "sed -i '1s/^pick/reword/'", {
        GIT_EDITOR: `cp ${shellQuote(messagePath)}`,
      }),
    );
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

async function hasParent(root: string, hash: string): Promise<boolean> {
  const res = await git(["rev-parse", "--verify", `${hash}^`], root);
  return res.exitCode === 0;
}

export async function undoCommit(root: string, hash: string): Promise<void> {
  await gitThrow(["reset", "--soft", `${hash}^`], root);
}

export function parseNameStatusLine(line: string): {
  status: string;
  from?: string;
  to: string;
} | null {
  const parts = line.split("\t");
  const [code, first] = parts;
  if (!(code && first)) {
    return null;
  }
  if (code.startsWith("R") || code.startsWith("C")) {
    const [, , to] = parts;
    if (!to) {
      return null;
    }
    return { from: first, status: code, to };
  }
  return { status: code, to: first };
}
