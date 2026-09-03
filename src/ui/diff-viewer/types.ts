import type { FileDiffMetadata } from "@pierre/diffs";

import type { CanonicalDiffRow } from "../../patch/rows";
import type { LineHighlightPaintIndex } from "./render/lineHighlightPaint";

export type DiffLayout = "split" | "stack";

/** Line stats shown by public Hunk OpenTUI primitives. */
export type DiffStats = {
  additions: number;
  deletions: number;
};

/** Input accepted by public OpenTUI components before defaults are normalized. */
export type DiffViewerFileInput = {
  id: string;
  isBinary?: boolean;
  isTooLarge?: boolean;
  isUntracked?: boolean;
  language?: string;
  metadata: FileDiffMetadata;
  patch?: string;
  path?: string;
  previousPath?: string;
  stats?: DiffStats;
  statsTruncated?: boolean;
  /** Pre-computed canonical rows, populated during file construction. */
  canonicalRows?: CanonicalDiffRow[];
};

/** Normalized diff file returned by createDiffViewerFile and patch helpers. */
export interface DiffViewerFile extends Omit<DiffViewerFileInput, "stats"> {
  stats: DiffStats;
}

/** One inline comment anchored to a canonical row, rendered as a note card. */
export type DiffNote = {
  /** Canonical row index the note block appears after. */
  anchorRow: number;
  /** Renders an inline composer prefilled with `text` instead of the note body. */
  editing?: boolean;
  /** First canonical row of the anchored range; rows before the anchor get a guide. */
  guideStartRow?: number;
  id: string;
  /** Called when the draft is cancelled (Esc or empty save). */
  onCancel?: () => void;
  /** Called when the trash icon is clicked on a saved note. */
  onDelete?: () => void;
  /** Called as the draft composer text changes. */
  onInput?: (text: string) => void;
  /** Called with the composer value when the draft is saved. */
  onSave?: (text: string) => void;
  text: string;
};

/** Public props shared by single-file diff body and view components. */
export type DiffBodyProps = {
  /**
   * Index of the cursor row in the canonical (stack) row list, resolved
   * against the rendered layout. The cursor paints a full-row background
   * highlight plus the active rail color.
   */
  cursorRow?: number;
  /** Canonical row index where visual selection started (via `v` key). */
  anchorRow?: number;
  file?: DiffViewerFileInput;
  /** Show the `+`/`-` sign column in the line-number gutter. */
  gutterSign?: boolean;
  highlight?: boolean;
  horizontalOffset?: number;
  layout?: DiffLayout;
  /** Source-line marks painted as backgrounds, keyed by `lineHighlightPaintKey`. */
  lineHighlights?: LineHighlightPaintIndex;
  /** Inline notes rendered as blocks after their anchored rows. */
  notes?: DiffNote[];
  /** Reports the rendered y-offset of the cursor row (accounts for note blocks). */
  onCursorOffsetResolved?: (offset: number) => void;
  /** Called when a diff row is clicked, with the canonical row index. */
  onRowMouseDown?: (canonicalRowIndex: number) => void;
  selectedHunkIndex?: number;
  showHunkHeaders?: boolean;
  showLineNumbers?: boolean;
  tabWidth?: number;
  /** Built-in theme id or "auto"; unknown ids fall back to the default theme. */
  theme?: string;
  width: number;
  wrapLines?: boolean;
};
