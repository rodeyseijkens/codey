import { useEffect, useState } from "react";

import { useAppState } from "../state/store";
import type { ToastKind } from "../types";
import { TOAST_KINDS } from "../types";
import { useColors } from "./color-context";
import { COMMENT_ICON, SPINNER_FRAMES, SPINNER_INTERVAL } from "./icons";
import { useMinimumVisible } from "./use-minimum-visible";

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
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const refreshing = useMinimumVisible(state.loading);

  useEffect(() => {
    if (!refreshing) {
      setSpinnerFrame(0);
      return;
    }
    const timer = setInterval(
      () => setSpinnerFrame((frame) => (frame + 1) % SPINNER_FRAMES.length),
      SPINNER_INTERVAL,
    );
    return () => clearInterval(timer);
  }, [refreshing]);

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
      {state.branch ? (
        <text style={{ fg: C.purple }}>{state.branch}</text>
      ) : null}
      {state.loaderMode === "diff" ? null : (
        <text style={{ fg: C.dim }}> [{state.loaderMode}]</text>
      )}
      {state.watchActive ? <text style={{ fg: C.green }}> watch</text> : null}
      <text style={{ flexGrow: 1 }}> </text>
      {state.comments.length > 0 ? (
        <text style={{ fg: C.commentFg }}>
          {`${COMMENT_ICON} ${state.comments.length} pending `}
        </text>
      ) : null}
      {refreshing ? (
        <text style={{ fg: C.dim }}>
          {`${SPINNER_FRAMES[spinnerFrame]} refreshing `}
        </text>
      ) : null}
      {state.toast ? (
        <text
          style={{ fg: toastColor(state.toast.kind, C), overflow: "hidden" }}
        >
          {state.toast.message}
        </text>
      ) : null}
    </box>
  );
}
