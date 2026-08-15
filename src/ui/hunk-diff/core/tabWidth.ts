export const DEFAULT_TAB_WIDTH = 4;
const MIN_TAB_WIDTH = 1;
const MAX_TAB_WIDTH = 16;

export function validateTabWidth(value: number, label = "tab width") {
  if (!Number.isSafeInteger(value) || value < MIN_TAB_WIDTH || value > MAX_TAB_WIDTH) {
    throw new Error(
      `Invalid ${label}: ${String(value)} (expected ${MIN_TAB_WIDTH}-${MAX_TAB_WIDTH})`,
    );
  }

  return value;
}
