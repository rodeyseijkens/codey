import { useAppState } from "../state/store";
import { useColors } from "./color-context";

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
        "j/k move · space collapse · a stage · A stage all · u unstage/discard · U discard all · b sidebar · t view · </> resize · r refresh · m layout · w wrap · ? help",
    };
  }
  const commitShown = state.commitView !== null && state.selection === null;
  if (commitShown) {
    return {
      color: C.dim,
      content: state.wrapLines
        ? "j/k move · ]/[ hunk · v select · c comment · e/d edit/del · n/N jump · y copy · s send · w unwrap · ? help"
        : "j/k move · ]/[ hunk · v select · c comment · e/d edit/del · n/N jump · y copy · s send · w wrap · ? help",
    };
  }
  return {
    color: C.dim,
    content: state.wrapLines
      ? "j/k move · ]/[ hunk · v select · c comment · e/d edit/del · n/N jump · y copy · s send · w unwrap · ? help"
      : "j/k move · ]/[ hunk · v select · c comment · e/d edit/del · n/N jump · y copy · s send · w wrap · ? help",
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
    </box>
  );
}
