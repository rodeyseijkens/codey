import { gitShow } from "../src/loaders/gitShow";
import { gitStaged } from "../src/loaders/gitStaged";
import { gitUnstaged } from "../src/loaders/gitUnstaged";
import { twoFile } from "../src/loaders/twoFile";
import {
  buildCanonicalDiffRows,
  createHunkDiffFilesFromPatch,
} from "../src/ui/hunk-diff/opentui";
import { getRepoRoot, isRepo } from "../src/vcs/git";

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const ms = (performance.now() - start).toFixed(1);
  console.info(`${label.padEnd(36)} ${ms.padStart(8)} ms`);
  return result;
}

async function runOnce(root: string, hasHeadCommit: boolean): Promise<void> {
  const staged = await time("gitStaged", () => gitStaged(root));
  const unstaged = await time("gitUnstaged", () => gitUnstaged(root));
  await time("canonical rows (all files)", () => {
    let rows = 0;
    for (const f of [...staged.files, ...unstaged.files]) {
      if (f.diff) {
        const files = createHunkDiffFilesFromPatch(f.diff, f.path);
        rows += files.reduce(
          (total, file) => total + buildCanonicalDiffRows(file).length,
          0,
        );
      }
    }
    return Promise.resolve(rows);
  });
  if (hasHeadCommit) {
    await time("gitShow HEAD", () => gitShow("HEAD", root));
    await time("twoFile HEAD HEAD", () => twoFile("HEAD", "HEAD", root));
  }
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  if (!(await isRepo(cwd))) {
    console.error("bench: run from inside a git repository");
    process.exit(1);
  }
  const root = await getRepoRoot(cwd);
  const hasHeadCommit =
    (await Bun.spawn(["git", "rev-parse", "--verify", "HEAD"], {
      cwd: root,
      stderr: "ignore",
      stdout: "ignore",
    }).exited) === 0;

  console.info(`benchmarking loaders in ${root}\n`);
  await runOnce(root, hasHeadCommit);
  await runOnce(root, hasHeadCommit);
  await runOnce(root, hasHeadCommit);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
