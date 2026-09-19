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
