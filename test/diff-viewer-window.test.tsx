import type { ReactNode } from "react";
import { act, useCallback, useEffect, useRef, useState } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { testRender } from "@opentui/react/test-utils";

import { DiffBody } from "../src/ui/diff-viewer/diff-body";
import { createDiffViewerFilesFromPatch } from "../src/ui/diff-viewer/model";
import type { DiffViewerFile } from "../src/ui/diff-viewer/types";
import { describe, expect, test } from "bun:test";

const LARGE_LINES = 5000;

const LARGE_DIFF = [
  "diff --git a/big.ts b/big.ts",
  "index 123..456 100644",
  "--- a/big.ts",
  "+++ b/big.ts",
  `@@ -1,${LARGE_LINES} +1,${LARGE_LINES} @@`,
  ...Array.from(
    { length: LARGE_LINES },
    (_, index) => ` line ${String(index).padStart(4, "0")}`,
  ),
  "",
].join("\n");

const [largeFile] = createDiffViewerFilesFromPatch(LARGE_DIFF, "large");
if (!largeFile) {
  throw new Error("expected one file");
}

type ScrollboxShape = {
  scrollHeight: number;
  scrollTop: number;
  viewport: { height: number };
};

function findScrollboxAncestor(
  node: { getChildren?: () => unknown[]; parent?: unknown } | null,
): ScrollboxShape | null {
  const maybe = node as unknown as {
    scrollTop: number;
    scrollHeight: number;
    viewport?: { height: number };
  };
  if (
    node &&
    typeof maybe.scrollTop === "number" &&
    typeof maybe.scrollHeight === "number" &&
    maybe.viewport?.height !== undefined
  ) {
    return maybe as ScrollboxShape;
  }
  for (const child of node?.getChildren?.() ?? []) {
    const found = findScrollboxAncestor(
      child as { getChildren?: () => unknown[] },
    );
    if (found) {
      return found;
    }
  }
  return null;
}

/** DiffBody inside a real scrollbox, feeding scroll metrics back like DiffPane does. */
function WindowedHarness({
  file,
  viewportHeight,
  wrapLines = false,
}: {
  file: DiffViewerFile;
  viewportHeight: number;
  wrapLines?: boolean;
}) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const [metrics, setMetrics] = useState({ scrollTop: 0, viewportHeight: 0 });
  useEffect(() => {
    const scroll = scrollRef.current;
    if (scroll === null) {
      return;
    }
    const { slider } = scroll.verticalScrollBar;
    const { viewport } = scroll;
    const sync = () => {
      const { height } = viewport;
      const { scrollTop } = scroll;
      setMetrics((prev) =>
        prev.scrollTop === scrollTop && prev.viewportHeight === height
          ? prev
          : { scrollTop, viewportHeight: height },
      );
    };
    sync();
    slider.on("change", sync);
    return () => {
      slider.off("change", sync);
    };
  }, []);
  const attachScrollbox = useCallback((el: ScrollBoxRenderable | null) => {
    scrollRef.current = el;
  }, []);
  return (
    <scrollbox height={20} ref={attachScrollbox} width={80}>
      <DiffBody
        file={file}
        layout="stack"
        scrollTop={metrics.scrollTop}
        viewportHeight={
          metrics.viewportHeight > 0 ? metrics.viewportHeight : viewportHeight
        }
        width={78}
        wrapLines={wrapLines}
      />
    </scrollbox>
  );
}

async function renderHarness(node: ReactNode, width = 100, height = 24) {
  const setup = await testRender(node, { height, width });
  await act(async () => {
    await setup.renderOnce();
  });
  return setup;
}

describe("DiffBody viewport window", () => {
  test("renders only the visible window plus overscan in a scrollbox", async () => {
    const setup = await renderHarness(
      <WindowedHarness file={largeFile} viewportHeight={20} />,
    );
    try {
      const frame = setup.captureCharFrame();
      expect(frame).toContain("line 0000");
      expect(frame).toContain("line 0010");
      expect(frame).not.toContain("line 0100");

      const sb = findScrollboxAncestor(setup.renderer.root);
      if (!sb) {
        throw new Error("expected scrollbox ancestor");
      }
      // Spacer heights must keep the scroll geometry equal to the full row list.
      expect(sb.scrollHeight).toBe(LARGE_LINES + 1);

      act(() => {
        sb.scrollTop = 2500;
      });
      await act(async () => {
        await setup.renderOnce();
      });
      const scrolled = setup.captureCharFrame();
      expect(scrolled).toContain("line 2500");
      expect(scrolled).not.toContain("line 0000");
      expect(scrolled).not.toContain("line 0100");
    } finally {
      await act(() => {
        setup.renderer.destroy();
      });
    }
  });

  test("keeps scroll geometry consistent at the file end", async () => {
    const setup = await renderHarness(
      <WindowedHarness file={largeFile} viewportHeight={20} />,
    );
    try {
      const sb = findScrollboxAncestor(setup.renderer.root);
      if (!sb) {
        throw new Error("expected scrollbox ancestor");
      }
      act(() => {
        sb.scrollTop = sb.scrollHeight;
      });
      await act(async () => {
        await setup.renderOnce();
      });
      const frame = setup.captureCharFrame();
      expect(frame).toContain("line 4999");
      expect(frame).not.toContain("line 0000");
      expect(sb.scrollTop).toBeGreaterThan(4900);
    } finally {
      await act(() => {
        setup.renderer.destroy();
      });
    }
  });

  test("uses measured heights when rows wrap", async () => {
    const wrapLines = 60;
    const WRAP_DIFF = [
      "diff --git a/wrap.ts b/wrap.ts",
      "index 123..456 100644",
      "--- a/wrap.ts",
      "+++ b/wrap.ts",
      `@@ -1,${wrapLines} +1,${wrapLines} @@`,
      ...Array.from(
        { length: wrapLines },
        (_, index) => ` ${"x".repeat(50)} ${index} ${"y".repeat(50)}`,
      ),
      "",
    ].join("\n");
    const [wrapFile] = createDiffViewerFilesFromPatch(WRAP_DIFF, "wrap");
    if (!wrapFile) {
      throw new Error("expected one file");
    }
    const setup = await renderHarness(
      <WindowedHarness file={wrapFile} viewportHeight={10} wrapLines={true} />,
    );
    try {
      const sb = findScrollboxAncestor(setup.renderer.root);
      if (!sb) {
        throw new Error("expected scrollbox ancestor");
      }
      // Each row wraps to 2 terminal rows at width 78: total = rows*2 + header.
      expect(sb.scrollHeight).toBe(wrapLines * 2 + 1);
      act(() => {
        sb.scrollTop = 80;
      });
      await act(async () => {
        await setup.renderOnce();
      });
      const frame = setup.captureCharFrame();
      // Row 40 sits at offset 80 once heights are measured; a wrong height
      // model would slice a different row here.
      expect(frame).toContain(" 40 ");
      expect(frame).not.toContain(" 1  1");
    } finally {
      await act(() => {
        setup.renderer.destroy();
      });
    }
  });
});
