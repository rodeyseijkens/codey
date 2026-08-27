export function parseJson(raw: string | undefined | null): unknown | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function asRecord(x: unknown): Record<string, unknown> | null {
  if (typeof x !== "object" || x === null || Array.isArray(x)) {
    return null;
  }
  return x as Record<string, unknown>;
}

export function asString(x: unknown): string | null {
  return typeof x === "string" ? x : null;
}

export function asArray(x: unknown): unknown[] | null {
  return Array.isArray(x) ? x : null;
}
