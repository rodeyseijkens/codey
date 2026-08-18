import {
  gitShow,
  gitStaged,
  gitUnstaged,
  stdinPatch,
  twoFile,
} from "./loaders/index";
import type { Changeset, LoaderMode } from "./types";
import {
  currentBranch,
  detectConflicts,
  getGitDir,
  getRepoRoot,
  isRepo,
} from "./vcs/git";

export interface LoadResult {
  branch: string | null;
  changesets: Changeset[];
  conflictNotice: string | null;
}

export type LoadFn = () => Promise<LoadResult>;

export interface RuntimeOptions {
  a?: string;
  b?: string;
  ignoreFiles?: readonly string[];
  mode: LoaderMode;
  patchInput?: string;
  rev?: string;
}

export interface Runtime {
  gitDir: string | null;
  load: LoadFn;
  mode: LoaderMode;
  repoRoot: string | null;
  stagingEnabled: boolean;
}

export async function buildRuntime(opts: RuntimeOptions): Promise<Runtime> {
  if (opts.mode === "patch" || opts.mode === "pager") {
    return {
      gitDir: null,
      load: async () => ({
        branch: null,
        changesets: [await stdinPatch(opts.patchInput, opts.ignoreFiles)],
        conflictNotice: null,
      }),
      mode: opts.mode,
      repoRoot: null,
      stagingEnabled: false,
    };
  }

  const cwd = process.cwd();
  if (!(await isRepo(cwd))) {
    throw new Error(`not a git repository: ${cwd}`);
  }
  const repoRoot = await getRepoRoot(cwd);
  const gitDir = await getGitDir(repoRoot);

  if (opts.mode === "show") {
    const rev = opts.rev ?? "HEAD";
    return {
      gitDir,
      load: async () => ({
        branch: await currentBranch(repoRoot),
        changesets: [await gitShow(rev, repoRoot, opts.ignoreFiles)],
        conflictNotice: null,
      }),
      mode: opts.mode,
      repoRoot,
      stagingEnabled: false,
    };
  }

  if (opts.mode === "twoFile") {
    if (!(opts.a && opts.b)) {
      throw new Error("two-file mode requires two refs or paths");
    }
    const { a, b } = opts;
    return {
      gitDir,
      load: async () => ({
        branch: await currentBranch(repoRoot),
        changesets: [await twoFile(a, b, repoRoot, opts.ignoreFiles)],
        conflictNotice: null,
      }),
      mode: opts.mode,
      repoRoot,
      stagingEnabled: false,
    };
  }

  return {
    gitDir,
    load: async () => {
      const [staged, changes, branch, conflicts] = await Promise.all([
        gitStaged(repoRoot, opts.ignoreFiles),
        gitUnstaged(repoRoot, opts.ignoreFiles),
        currentBranch(repoRoot),
        detectConflicts(gitDir),
      ]);
      return {
        branch,
        changesets: [staged, changes],
        conflictNotice: conflicts.busy
          ? "merge/rebase/cherry-pick in progress — staging may behave unexpectedly"
          : null,
      };
    },
    mode: "diff",
    repoRoot,
    stagingEnabled: true,
  };
}
