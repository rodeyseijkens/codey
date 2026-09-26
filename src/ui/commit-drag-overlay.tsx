import type { MouseEvent } from "@opentui/core";
import { RGBA } from "@opentui/core";

import { dragCommitPane, endCommitPaneDrag } from "../state/actions/navigation";
import { useAppState } from "../state/store";

export function CommitPaneDragOverlay() {
  const { commitDrag } = useAppState();
  if (!commitDrag) {
    return null;
  }
  return (
    <box
      onMouseDrag={(e: MouseEvent) => {
        dragCommitPane(e.y);
      }}
      onMouseDragEnd={() => {
        endCommitPaneDrag();
      }}
      onMouseMove={(e: MouseEvent) => {
        dragCommitPane(e.y);
      }}
      onMouseUp={() => {
        endCommitPaneDrag();
      }}
      style={{
        backgroundColor: RGBA.fromInts(0, 0, 0, 0),
        height: "100%",
        position: "absolute",
        width: "100%",
      }}
    />
  );
}
