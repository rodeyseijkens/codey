import type { ToastKind } from "../state/store";
import { useAppState } from "../state/store";
import { useColors } from "./color-context";

function toastColor(
  kind: ToastKind,
  C: ReturnType<typeof useColors>["ui"]
): string {
  switch (kind) {
    case "error":
      return C.red;
    case "success":
      return C.green;
    case "warn":
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
      {state.sidebarView === "tree" ? (
        <text style={{ fg: C.dim }}>tree</text>
      ) : (
        <text style={{ fg: C.dim }}>list</text>
      )}
    </box>
  );
}

export function BottomBar() {
  const state = useAppState();
  const { ui: C } = useColors();

  let content: string;
  let color = C.dim;

  if (state.pendingStage) {
    content = `press stage key again to confirm (${state.pendingStage.commentCount} comment(s) will be cleared) — Esc to cancel`;
    color = C.yellow;
  } else if (state.toast) {
    content = state.toast.message;
    color = toastColor(state.toast.kind, C);
  } else if (state.loading) {
    content = "loading...";
  } else if (!state.stagingEnabled) {
    content =
      "j/k move · ]/[ hunk · f/F file · Tab focus · c comment · s send · ? help — staging disabled in this mode";
  } else if (state.focus === "sidebar") {
    content =
      "j/k move · space collapse · Tab focus diff · a stage · A stage all · u unstage/discard · U discard all · ? help";
  } else {
    content = state.wrapLines
      ? "j/k move · ]/[ hunk · v select · c comment · e/d edit/del · n/N jump · s send · w unwrap · ? help"
      : "j/k move · ]/[ hunk · v select · c comment · e/d edit/del · n/N jump · s send · w wrap · ? help";
  }

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
