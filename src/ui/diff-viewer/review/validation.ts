export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x8_00) {
      bytes += 2;
    } else if (code >= 0xd8_00 && code <= 0xdb_ff) {
      const next = index + 1 < value.length ? value.charCodeAt(index + 1) : 0;
      if (next >= 0xdc_00 && next <= 0xdf_ff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function hasExactKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
) {
  const keys = Object.keys(record);
  return (
    keys.length === allowed.length && keys.every((key) => allowed.includes(key))
  );
}

export const REVIEW_DIGEST_ALGORITHM = "sha256" as const;

export type ReviewDigestFn = (bytes: Uint8Array) => string;

const REVIEW_SHA256_DIGEST_PATTERN = /^[0-9a-f]{64}$/;

export function isReviewSha256Digest(value: unknown): value is string {
  return typeof value === "string" && REVIEW_SHA256_DIGEST_PATTERN.test(value);
}

export function reviewDigestsEqual(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}
