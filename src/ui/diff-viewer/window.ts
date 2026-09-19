/** Prefix offsets over per-row heights: `prefix[i]` is the rendered y-offset of row i. */
export type RowOffsets = {
  prefix: number[];
  totalHeight: number;
};

/** Build prefix sums over per-row heights for window slicing and cursor offsets. */
export function buildRowOffsets(heights: readonly number[]): RowOffsets {
  const prefix = new Array<number>(heights.length + 1);
  prefix[0] = 0;
  for (let index = 0; index < heights.length; index += 1) {
    prefix[index + 1] = (prefix[index] ?? 0) + (heights[index] ?? 0);
  }
  return { prefix, totalHeight: prefix[heights.length] ?? 0 };
}

export type RowWindow = {
  /** First rendered row index. */
  start: number;
  /** One past the last rendered row index. */
  end: number;
  /** Height of the spacer replacing the rows before the window. */
  topOffset: number;
  /** Height of the spacer replacing the rows after the window. */
  bottomSpacer: number;
};

/** Default rows rendered beyond the visible window on each side. */
export const DEFAULT_WINDOW_OVERSCAN = 30;

/** Smallest row index whose bottom edge (`prefix[i + 1]`) lies strictly past `y`. */
function firstRowPast(prefix: readonly number[], y: number): number {
  let low = 0;
  let high = prefix.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if ((prefix[mid + 1] ?? 0) <= y) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

/** Smallest row index whose top edge (`prefix[i]`) is at or past `y`. */
function firstRowAtLeast(prefix: readonly number[], y: number): number {
  let low = 0;
  let high = prefix.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if ((prefix[mid] ?? 0) < y) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

/**
 * Slice the visible row window for a scroll position, padding each side with
 * `overscan` rows. Row heights come as prefix sums so the slice is a binary
 * search regardless of file size. When `mustInclude` is given, that row is
 * always inside the window so the cursor never renders outside it: a cursor
 * that already sits near the viewport widens the slice, while a distant one
 * recenters the slice on itself so a programmatic jump cannot mount every row
 * in between while the scroll position is still one render behind.
 */
export function computeRowWindow(
  prefix: readonly number[],
  scrollTop: number,
  viewportHeight: number,
  overscan: number,
  mustInclude?: number,
): RowWindow {
  const count = Math.max(0, prefix.length - 1);
  const totalHeight = prefix[count] ?? 0;
  if (count === 0) {
    return { bottomSpacer: 0, end: 0, start: 0, topOffset: 0 };
  }

  const top = Math.max(0, Math.floor(scrollTop));
  const viewport = Math.floor(viewportHeight);
  if (viewport <= 0) {
    return { bottomSpacer: 0, end: count, start: 0, topOffset: 0 };
  }

  const firstVisible = firstRowPast(prefix, top);
  const endVisible = Math.min(count, firstRowAtLeast(prefix, top + viewport));
  let start = Math.max(0, firstVisible - overscan);
  let end = Math.min(count, endVisible + overscan);

  if (mustInclude !== undefined && mustInclude >= 0) {
    const cursor = Math.min(count - 1, mustInclude);
    const insideWindow = cursor >= start && cursor < end;
    if (insideWindow) {
      start = Math.max(0, Math.min(start, cursor - overscan));
      end = Math.max(end, Math.min(count, cursor + overscan + 1));
    } else {
      start = Math.max(0, Math.min(count, cursor - overscan));
      end = Math.min(count, Math.max(start + 1, cursor + overscan + 1));
    }
  }

  const topOffset = prefix[start] ?? 0;
  const bottomSpacer = Math.max(0, totalHeight - (prefix[end] ?? totalHeight));
  return { bottomSpacer, end, start, topOffset };
}
