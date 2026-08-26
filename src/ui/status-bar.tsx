import { useAppState } from "../state/store";
import type { ToastKind } from "../types";
import { SIDEBAR_VIEWS, TOAST_KINDS } from "../types";
import { useColors } from "./color-context";

function toastColor(
  kind: ToastKind,
  C: ReturnType<typeof useColors>["ui"],
): string {
  switch (kind) {
    case TOAST_KINDS.error:
      return C.red;
    case TOAST_KINDS.success:
      return C.green;
    case TOAST_KINDS.warn:
      return C.yellow;
    default:
      return C.fg;
  }
}

export function TopBar() {
  const state = useAppState();
  const { ui: C } = useColors();
  return (
    <box
      style={{
        backgroundColor: C.panel,
        flexDirection: "row",
        height: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text style={{ fg: C.accent }}>codey</text>
      {state.branch ? (
        <text style={{ fg: C.purple }}> {state.branch}</text>
      ) : null}
      <text style={{ fg: C.dim }}> [{state.loaderMode}]</text>
      {state.watchActive ? <text style={{ fg: C.green }}> watch</text> : null}
      <text style={{ fg: C.dim }}> layout:{state.layoutMode}</text>
      <text style={{ flexGrow: 1 }}> </text>
      {state.sidebarView === SIDEBAR_VIEWS.tree ? (
        <text style={{ fg: C.dim }}>tree</text>
      ) : (
        <text style={{ fg: C.dim }}>list</text>
      )}
    </box>
  );
}

function bottomBarContent(
  state: ReturnType<typeof useAppState>,
  C: ReturnType<typeof useColors>["ui"],
): { color: string; content: string } {
  if (state.pendingStage) {
    return {
      color: C.yellow,
      content: `press stage key again to confirm (${state.pendingStage.commentCount} comment(s) will be cleared) — Esc to cancel`,
    };
  }
  if (state.toast) {
    return {
      color: toastColor(state.toast.kind, C),
      content: state.toast.message,
    };
  }
  if (state.loading) {
    return { color: C.dim, content: "loading..." };
  }
  if (!state.stagingEnabled) {
    return {
      color: C.dim,
      content:
        "j/k move · ]/[ hunk · f/F file · c comment · s send · ? help — staging disabled in this mode",
    };
  }
  if (state.focus === "commits") {
    return {
      color: C.dim,
      content:
        "j/k move · space expand · f/F file · c commit · p pull · P push · g edit · alt+j/k reorder · ? help",
    };
  }
  if (state.focus === "sidebar") {
    return {
      color: C.dim,
      content:
        "j/k move · space collapse · a stage · A stage all · u unstage/discard · U discard all · ? help",
    };
  }
  const commitShown = state.commitView !== null && state.selection === null;
  if (commitShown) {
    return {
      color: C.dim,
      content: state.wrapLines
        ? "j/k move · ]/[ hunk · w unwrap · ? help"
        : "j/k move · ]/[ hunk · w wrap · ? help",
    };
  }
  return {
    color: C.dim,
    content: state.wrapLines
      ? "j/k move · ]/[ hunk · v select · c comment · e/d edit/del · n/N jump · s send · w unwrap · ? help"
      : "j/k move · ]/[ hunk · v select · c comment · e/d edit/del · n/N jump · s send · w wrap · ? help",
  };
}

export function BottomBar() {
  const state = useAppState();
  const { ui: C } = useColors();
  const { color, content } = bottomBarContent(state, C);

  return (
    <box
      style={{
        backgroundColor: C.panel,
        flexDirection: "row",
        height: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text style={{ fg: color, overflow: "hidden" }}>{content}</text>
      <text style={{ flexGrow: 1 }}> </text>
      {state.comments.length > 0 ? (
        <text style={{ fg: C.commentFg }}>
          {" "}
          {state.comments.length} pending
        </text>
      ) : null}
    </box>
  );
}
