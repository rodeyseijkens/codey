import { gitShow } from "../src/loaders/gitShow";
import { gitStaged } from "../src/loaders/gitStaged";
import { gitUnstaged } from "../src/loaders/gitUnstaged";
import { twoFile } from "../src/loaders/twoFile";
import {
  buildCanonicalDiffRows,
  createDiffViewerFilesFromPatch,
  toInternalDiffFile,
} from "../src/ui/diff-viewer/model";
import {
  buildSplitRows,
  buildStackRows,
} from "../src/ui/diff-viewer/render/pierre";
import { measureRenderedRowHeight } from "../src/ui/diff-viewer/render/renderRows";
import {
  buildRowOffsets,
  computeRowWindow,
} from "../src/ui/diff-viewer/window";
import { resolveTheme } from "../src/ui/theme/resolve";
import { getRepoRoot, isRepo } from "../src/vcs/git";

const BENCH_LINES = 10_000;

function generateLargePatch(lineCount: number): string {
  const lines = Array.from(
    { length: lineCount },
    (_, index) => ` line ${index}`,
  );
  return [
    "diff --git a/generated.ts b/generated.ts",
    "index 123..456 100644",
    "--- a/generated.ts",
    "+++ b/generated.ts",
    `@@ -1,${lineCount} +1,${lineCount} @@`,
    ...lines,
    "",
  ].join("\n");
}

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
  await timeBenchRenderPath();
}

/** Time the render-path hot loop on a generated patch: row build, height walk, window slice. */
async function timeBenchRenderPath(): Promise<void> {
  const patch = generateLargePatch(BENCH_LINES);
  const [viewerFile] = await time(`parse ${BENCH_LINES}-line patch`, () =>
    createDiffViewerFilesFromPatch(patch, "bench"),
  );
  if (!viewerFile) {
    return;
  }
  const internal = toInternalDiffFile(viewerFile);
  const theme = resolveTheme("github-dark-default", null);
  const split = await time(`buildSplitRows (${BENCH_LINES} lines)`, () =>
    buildSplitRows(internal, null, theme),
  );
  await time(`buildStackRows (${BENCH_LINES} lines)`, () =>
    buildStackRows(internal, null, theme),
  );
  const offsets = await time(`row heights + offsets (${BENCH_LINES})`, () =>
    buildRowOffsets(
      split.rows.map((row) =>
        measureRenderedRowHeight(row, 120, 5, true, false, false, theme),
      ),
    ),
  );
  await time("window slices x100", () => {
    let total = 0;
    for (let index = 0; index < 100; index += 1) {
      const win = computeRowWindow(
        offsets.prefix,
        index * (offsets.totalHeight / 100),
        40,
        30,
      );
      total += win.end - win.start;
    }
    return total;
  });
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
