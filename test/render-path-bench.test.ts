import {
  type RenderPathBenchResult,
  type RenderPathTimings,
  runRenderPathBench,
} from "../scripts/bench-render-path";
import { beforeAll, describe, expect, test } from "bun:test";

let bench: RenderPathBenchResult;

beforeAll(() => {
  bench = runRenderPathBench();
});

describe("render-path bench harness", () => {
  test("builds rows, heights, and offsets for the generated patch", () => {
    expect(bench.lineCount).toBe(10_000);
    expect(bench.rowCount).toBe(bench.lineCount + 1);
    expect(bench.totalHeight).toBe(bench.lineCount);
    expect(bench.maxWindowRows).toBeGreaterThan(0);
    expect(bench.maxWindowRows).toBeLessThanOrEqual(40 + 2 * 30);
  });

  test("keeps every render-path stage within its coarse time budget", () => {
    const budgetMs: RenderPathTimings = {
      heightsOffsetsMs: 200,
      parseMs: 500,
      splitRowsMs: 500,
      stackRowsMs: 500,
      windowSlicesMs: 200,
    };
    expect(bench.timings.parseMs).toBeLessThan(budgetMs.parseMs);
    expect(bench.timings.splitRowsMs).toBeLessThan(budgetMs.splitRowsMs);
    expect(bench.timings.stackRowsMs).toBeLessThan(budgetMs.stackRowsMs);
    expect(bench.timings.heightsOffsetsMs).toBeLessThan(
      budgetMs.heightsOffsetsMs,
    );
    expect(bench.timings.windowSlicesMs).toBeLessThan(budgetMs.windowSlicesMs);
  });
});
