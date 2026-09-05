import type { ReactNode } from "react";
import { act } from "react";
import { testRender } from "@opentui/react/test-utils";

import { DiffBody } from "../src/ui/diff-viewer/diff-body";
import {
  createDiffViewerFilesFromPatch,
  toInternalDiffFile,
} from "../src/ui/diff-viewer/model";
import { buildLineHighlightPaintIndex } from "../src/ui/diff-viewer/render/lineHighlightPaint";
import type { DiffNote } from "../src/ui/diff-viewer/types";
import { describe, expect, test } from "bun:test";

const DIFF = `diff --git a/foo.ts b/foo.ts
index 123..456 100644
--- a/foo.ts
+++ b/foo.ts
@@ -1,5 +1,5 @@
 line1
-line2 old
+line2 new
 line3
 line4
 line5
`;

const [file] = createDiffViewerFilesFromPatch(DIFF, "example");
if (!file) {
  throw new Error("expected one file");
}

function trackResolved(resolved: number[]): (index: number) => void {
  return (index) => resolved.push(index);
}

async function captureFrame(node: ReactNode, width = 120, height = 24) {
  const setup = await testRender(node, { height, width });
  try {
    await act(async () => {
      await setup.renderOnce();
    });
    return setup.captureCharFrame();
  } finally {
    await act(() => {
      setup.renderer.destroy();
    });
  }
}

describe("DiffBody extension", () => {
  test("renders a diff with a cursor row", async () => {
    const frame = await captureFrame(
      <DiffBody cursorRow={2} file={file} layout="stack" width={80} />,
    );
    expect(frame).toContain("line2 new");
    expect(frame).toContain("line2 old");
  });

  test("reports the resolved layout row for the cursor", async () => {
    const resolved: number[] = [];
    const setup = await testRender(
      <DiffBody
        cursorRow={2}
        file={file}
        layout="stack"
        onCursorOffsetResolved={trackResolved(resolved)}
        width={80}
      />,
      { height: 24, width: 80 },
    );
    try {
      await act(async () => {
        await setup.renderOnce();
      });
      expect(resolved.at(-1)).toBe(2);
    } finally {
      act(() => {
        setup.renderer.destroy();
      });
    }
  });

  test("resolves a canonical cursor row against the split layout", async () => {
    const resolved: number[] = [];
    const setup = await testRender(
      <DiffBody
        cursorRow={3}
        file={file}
        layout="split"
        onCursorOffsetResolved={trackResolved(resolved)}
        width={80}
      />,
      { height: 24, width: 80 },
    );
    try {
      await act(async () => {
        await setup.renderOnce();
      });
      // Split layout pairs the deletion+addition into one change row.
      expect(resolved.at(-1)).toBe(2);
    } finally {
      act(() => {
        setup.renderer.destroy();
      });
    }
  });

  test("renders with line highlights", async () => {
    const internal = toInternalDiffFile(file);
    const lineHighlights = buildLineHighlightPaintIndex({
      file: internal,
      marks: [
        { end: 100, line: 2, side: "new", start: 0, tone: "info" },
        { end: 100, line: 2, side: "old", start: 0, tone: "info" },
      ],
    });
    expect(lineHighlights).toBeDefined();
    const frame = await captureFrame(
      <DiffBody
        file={file}
        layout="stack"
        lineHighlights={lineHighlights}
        width={80}
      />,
    );
    expect(frame).toContain("line2 new");
  });

  test("renders inline notes after their anchored rows", async () => {
    const notes: DiffNote[] = [
      { anchorRow: 3, id: "n1", text: "should this be here?" },
    ];
    const frame = await captureFrame(
      <DiffBody file={file} layout="stack" notes={notes} width={80} />,
    );
    expect(frame).toContain("\uf4f6");
    expect(frame).toContain("foo.ts");
    expect(frame).toContain("should this be here?");
    expect(frame.indexOf("should this be here?")).toBeGreaterThan(
      frame.indexOf("line2 new"),
    );
  });

  test("cursor offset accounts for note blocks above the cursor", async () => {
    const resolved: number[] = [];
    const notes: DiffNote[] = [
      { anchorRow: 0, id: "n1", text: "note on the header" },
    ];
    const setup = await testRender(
      <DiffBody
        cursorRow={2}
        file={file}
        layout="stack"
        notes={notes}
        onCursorOffsetResolved={trackResolved(resolved)}
        width={80}
      />,
      { height: 24, width: 80 },
    );
    try {
      await act(async () => {
        await setup.renderOnce();
      });
      // Rows above the cursor: header (1) + card (top/body/bottom = 3) + context (1).
      expect(resolved.at(-1)).toBe(5);
    } finally {
      act(() => {
        setup.renderer.destroy();
      });
    }
  });

  test("renders a draft input for editing notes", async () => {
    const notes: DiffNote[] = [
      {
        anchorRow: 3,
        editing: true,
        id: "draft",
        onSave: () => undefined,
        text: "draft text",
      },
    ];
    const frame = await captureFrame(
      <DiffBody file={file} layout="stack" notes={notes} width={80} />,
    );
    expect(frame).toContain("\uf448");
    expect(frame).toContain("draft text");
  });
});
