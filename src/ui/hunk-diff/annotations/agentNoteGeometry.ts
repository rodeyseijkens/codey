import { resolveSplitPaneWidths } from "../diff/codeColumns";
import type { LayoutMode } from "../diff/types";

export type AgentNoteGeometryInput = {
  anchorSide?: "old" | "new";
  layout: Exclude<LayoutMode, "auto">;
  /** Diff pane content width (the `width` prop the diff view renders at). */
  width: number;
};

export type AgentNoteBoxLayout = {
  /** Columns of left padding before the card starts. */
  boxLeft: number;
  /** Total card width including its borders. */
  boxWidth: number;
  /** Width the note body (summary text or STML markup) is laid out at. */
  contentWidth: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Resolve the note card's box placement for one anchor side and pane width. */
export function agentNoteBoxLayout({
  anchorSide,
  layout,
  width,
}: AgentNoteGeometryInput): AgentNoteBoxLayout {
  const splitWidths = resolveSplitPaneWidths(width);
  const canDockRight =
    layout === "split" && anchorSide === "new" && width >= 84;
  const canDockLeft = layout === "split" && anchorSide === "old" && width >= 84;
  let preferredDockWidth: number;
  if (canDockRight) {
    preferredDockWidth = splitWidths.rightWidth;
  } else if (canDockLeft) {
    preferredDockWidth = splitWidths.leftWidth;
  } else {
    preferredDockWidth = Math.max(34, width - 4);
  }
  const boxWidth = clamp(preferredDockWidth, 28, Math.max(28, width - 4));
  let boxLeft: number;
  if (canDockRight) {
    boxLeft = Math.max(0, width - boxWidth);
  } else if (canDockLeft) {
    boxLeft = 0;
  } else {
    boxLeft = Math.min(4, Math.max(0, width - boxWidth));
  }
  const innerWidth = Math.max(1, boxWidth - 2);
  const contentWidth = Math.max(1, innerWidth - 2);

  return { boxLeft, boxWidth, contentWidth };
}
