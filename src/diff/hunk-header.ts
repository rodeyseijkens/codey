import type { ReviewHunkSpan } from "./gap";

/**
 * The facts a hunk header is built from.
 *
 * Structural rather than the parser's own type, so a parsed hunk and a projected semantic
 * hunk both satisfy it and the header can never depend on which model a caller holds.
 */
export interface ReviewHunkHeaderSource extends ReviewHunkSpan {
  hunkContext?: string | null;
  hunkSpecs?: string | null;
}

export function formatHunkHeader(hunk: ReviewHunkHeaderSource): string {
  const specs =
    hunk.hunkSpecs ??
    `@@ -${hunk.deletionStart},${hunk.deletionCount} +${hunk.additionStart},${hunk.additionCount} @@`;
  return hunk.hunkContext ? `${specs} ${hunk.hunkContext}` : specs;
}
