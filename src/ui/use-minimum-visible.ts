import { useEffect, useRef, useState } from "react";

export const MIN_VISIBLE_MS = 300;

/** Keep an indicator visible for a minimum duration so quick loads still show. */
export function useMinimumVisible(
  active: boolean,
  minVisibleMs = MIN_VISIBLE_MS,
): boolean {
  const [visible, setVisible] = useState(active);
  const shownAtRef = useRef<number | null>(active ? Date.now() : null);

  useEffect(() => {
    if (active) {
      shownAtRef.current = Date.now();
      setVisible(true);
      return;
    }
    if (shownAtRef.current === null) {
      return;
    }
    const remaining = minVisibleMs - (Date.now() - shownAtRef.current);
    if (remaining <= 0) {
      shownAtRef.current = null;
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => {
      shownAtRef.current = null;
      setVisible(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [active, minVisibleMs]);

  return visible;
}
