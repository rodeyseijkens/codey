import type { TextareaRenderable } from "@opentui/core";
import { type RefObject, useEffect, useRef } from "react";
import { useAppState } from "../state/store";

/**
 * Clear the textarea contents whenever the store signals a draft-clear
 * request (`draftClearTick` changes). The initial render is skipped so a
 * draft's prefilled value is preserved until the user asks to clear it.
 */
export function useDraftClear(
  textareaRef: RefObject<TextareaRenderable | null>
): void {
  const { draftClearTick } = useAppState();
  const prevTick = useRef(draftClearTick);
  useEffect(() => {
    if (prevTick.current === draftClearTick) {
      return;
    }
    prevTick.current = draftClearTick;
    textareaRef.current?.setText("");
  }, [draftClearTick, textareaRef]);
}
