import {
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

export const BENCH_LINES = 10_000;

const BENCH_WIDTH = 120;
const BENCH_LINE_NUMBER_DIGITS = 5;
const BENCH_WINDOW_SLICES = 100;
const BENCH_VIEWPORT_HEIGHT = 40;
const BENCH_OVERSCAN = 30;
const SHOW_LINE_NUMBERS = true;
const SHOW_HUNK_HEADERS = false;
const WRAP_LINES = false;

export type RenderPathTimings = {
  heightsOffsetsMs: number;
  parseMs: number;
  splitRowsMs: number;
  stackRowsMs: number;
  windowSlicesMs: number;
};

export type RenderPathBenchResult = {
  lineCount: number;
  maxWindowRows: number;
  rowCount: number;
  timings: RenderPathTimings;
  totalHeight: number;
};

export function generateLargePatch(lineCount: number): string {
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

function elapsed<T>(fn: () => T): [T, number] {
  const start = performance.now();
  const result = fn();
  return [result, performance.now() - start];
}

/** Time the render-path hot loop on a generated patch: row build, height walk, window slice. */
export function runRenderPathBench(
  lineCount = BENCH_LINES,
): RenderPathBenchResult {
  const timings: RenderPathTimings = {
    heightsOffsetsMs: 0,
    parseMs: 0,
    splitRowsMs: 0,
    stackRowsMs: 0,
    windowSlicesMs: 0,
  };

  const patch = generateLargePatch(lineCount);
  const [files, parseMs] = elapsed(() =>
    createDiffViewerFilesFromPatch(patch, "bench"),
  );
  timings.parseMs = parseMs;
  const [viewerFile] = files;
  if (!viewerFile) {
    throw new Error("bench patch produced no viewer file");
  }

  const internal = toInternalDiffFile(viewerFile);
  const theme = resolveTheme("github-dark-default", null);
  const [split, splitMs] = elapsed(() => buildSplitRows(internal, null, theme));
  timings.splitRowsMs = splitMs;

  const [, stackMs] = elapsed(() => buildStackRows(internal, null, theme));
  timings.stackRowsMs = stackMs;

  const [offsets, heightsMs] = elapsed(() =>
    buildRowOffsets(
      split.rows.map((row) =>
        measureRenderedRowHeight(
          row,
          BENCH_WIDTH,
          BENCH_LINE_NUMBER_DIGITS,
          SHOW_LINE_NUMBERS,
          SHOW_HUNK_HEADERS,
          WRAP_LINES,
          theme,
        ),
      ),
    ),
  );
  timings.heightsOffsetsMs = heightsMs;

  const [maxWindowRows, slicesMs] = elapsed(() => {
    let widest = 0;
    for (let index = 0; index < BENCH_WINDOW_SLICES; index += 1) {
      const win = computeRowWindow(
        offsets.prefix,
        index * (offsets.totalHeight / BENCH_WINDOW_SLICES),
        BENCH_VIEWPORT_HEIGHT,
        BENCH_OVERSCAN,
      );
      widest = Math.max(widest, win.end - win.start);
    }
    return widest;
  });
  timings.windowSlicesMs = slicesMs;

  return {
    lineCount,
    maxWindowRows,
    rowCount: split.rows.length,
    timings,
    totalHeight: offsets.totalHeight,
  };
}
