export const MIN_NPM_VERSION = [11, 5, 1] as const;

export function isOlderVersion(
  actual: readonly number[],
  minimum: readonly number[],
): boolean {
  for (const [i, min] of minimum.entries()) {
    const part = actual[i];
    if (part === undefined) {
      return true;
    }
    if (part !== min) {
      return part < min;
    }
  }
  return false;
}
