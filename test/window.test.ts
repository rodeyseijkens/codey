import {
  buildRowOffsets,
  computeRowWindow,
} from "../src/ui/diff-viewer/window";
import { describe, expect, test } from "bun:test";

describe("buildRowOffsets", () => {
  test("builds prefix sums and total height", () => {
    const offsets = buildRowOffsets([1, 3, 2, 1]);
    expect(offsets.prefix).toEqual([0, 1, 4, 6, 7]);
    expect(offsets.totalHeight).toBe(7);
  });

  test("handles empty heights", () => {
    const offsets = buildRowOffsets([]);
    expect(offsets.prefix).toEqual([0]);
    expect(offsets.totalHeight).toBe(0);
  });
});

describe("computeRowWindow", () => {
  const { prefix } = buildRowOffsets(Array.from({ length: 1000 }, () => 1));

  test("bounds the slice by viewport plus overscan regardless of file size", () => {
    const win = computeRowWindow(prefix, 500, 30, 10);
    expect(win.end - win.start).toBeLessThanOrEqual(30 + 2 * 10);
    expect(win.start).toBeGreaterThanOrEqual(500 - 30 - 10);
    expect(win.end).toBeGreaterThanOrEqual(530);
  });

  test("clamps to the row list at the file end", () => {
    const win = computeRowWindow(prefix, 990, 30, 10);
    expect(win.end).toBe(1000);
    expect(win.bottomSpacer).toBe(0);
  });

  test("clamps to zero at the file start", () => {
    const win = computeRowWindow(prefix, 0, 30, 10);
    expect(win.start).toBe(0);
    expect(win.topOffset).toBe(0);
  });

  test("covers the whole list when viewport height is unknown", () => {
    const win = computeRowWindow(prefix, 500, 0, 10);
    expect(win.start).toBe(0);
    expect(win.end).toBe(1000);
    expect(win.topOffset).toBe(0);
    expect(win.bottomSpacer).toBe(0);
  });

  test("mustInclude pulls the cursor row into the window", () => {
    const win = computeRowWindow(prefix, 0, 30, 10, 900);
    expect(win.start).toBeLessThanOrEqual(900 - 10);
    expect(win.end).toBeGreaterThan(900);
  });

  test("a distant cursor recenters a bounded window instead of spanning to it", () => {
    // A programmatic jump renders with the new cursor before scrollTop catches
    // up; stretching the slice to cover both would mount every row in between.
    const win = computeRowWindow(prefix, 0, 30, 10, 900);
    expect(win.end - win.start).toBeLessThanOrEqual(30 + 2 * 10);
    expect(win.start).toBe(890);
    expect(win.end).toBe(911);
  });

  test("a cursor inside the overscan band keeps the viewport mounted", () => {
    const win = computeRowWindow(prefix, 100, 30, 10, 135);
    expect(win.start).toBeLessThanOrEqual(100);
    expect(win.end).toBeGreaterThanOrEqual(130);
    expect(win.end).toBeGreaterThan(135);
  });

  test("clamps a distant cursor at the row list end", () => {
    const win = computeRowWindow(prefix, 0, 30, 10, 5000);
    expect(win.end).toBe(1000);
    expect(win.start).toBe(989);
    expect(win.bottomSpacer).toBe(0);
  });

  test("spacers stay consistent for a recentered distant cursor", () => {
    const win = computeRowWindow(prefix, 0, 30, 10, 900);
    const sliceHeight = (prefix[win.end] ?? 0) - (prefix[win.start] ?? 0);
    expect(win.topOffset + sliceHeight + win.bottomSpacer).toBe(1000);
  });
});

describe("computeRowWindow spacers", () => {
  test("top and bottom spacers plus slice height equal the total height", () => {
    const offsets = buildRowOffsets([1, 2, 3, 4, 5]);
    const win = computeRowWindow(offsets.prefix, 3, 4, 0);
    const sliceHeight =
      (offsets.prefix[win.end] ?? 0) - (offsets.prefix[win.start] ?? 0);
    expect(win.topOffset + sliceHeight + win.bottomSpacer).toBe(
      offsets.totalHeight,
    );
  });
});
