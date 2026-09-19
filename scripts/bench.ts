import { gitShow } from "../src/loaders/gitShow";
import { gitStaged } from "../src/loaders/gitStaged";
import { gitUnstaged } from "../src/loaders/gitUnstaged";
import { twoFile } from "../src/loaders/twoFile";
import {
  buildCanonicalDiffRows,
  createDiffViewerFilesFromPatch,
} from "../src/ui/diff-viewer/model";
import { getRepoRoot, isRepo } from "../src/vcs/git";
import {
  type RenderPathBenchResult,
  runRenderPathBench,
} from "./bench-render-path";

async function time<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
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
        const files = createDiffViewerFilesFromPatch(f.diff, f.path);
        rows += files.reduce(
          (total, file) => total + buildCanonicalDiffRows(file).length,
          0,
        );
      }
    }
    return rows;
  });
  if (hasHeadCommit) {
    await time("gitShow HEAD", () => gitShow("HEAD", root));
    await time("twoFile HEAD HEAD", () => twoFile("HEAD", "HEAD", root));
  }
  printRenderPathTimings(runRenderPathBench());
}

/** Print the structured render-path timings collected by the shared bench harness. */
function printRenderPathTimings(result: RenderPathBenchResult): void {
  const { lineCount, timings } = result;
  const entries: [string, number][] = [
    [`parse ${lineCount}-line patch`, timings.parseMs],
    [`buildSplitRows (${lineCount} lines)`, timings.splitRowsMs],
    [`buildStackRows (${lineCount} lines)`, timings.stackRowsMs],
    [`row heights + offsets (${lineCount})`, timings.heightsOffsetsMs],
    ["window slices x100", timings.windowSlicesMs],
  ];
  for (const [label, ms] of entries) {
    console.info(`${label.padEnd(36)} ${ms.toFixed(1).padStart(8)} ms`);
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
