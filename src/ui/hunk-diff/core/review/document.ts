export type ReviewEmptyDiffReason =
  | "rename-only"
  | "binary"
  | "too-large"
  | "new-file"
  | "deleted-file"
  | "no-hunks";

export interface ReviewEmptyDiffSubject {
  changeKind: "change" | "rename-pure" | "rename-changed" | "new" | "deleted";
  binary: boolean;
  tooLarge: boolean;
}

export function reviewEmptyDiffReason({
  changeKind,
  binary,
  tooLarge,
}: ReviewEmptyDiffSubject): ReviewEmptyDiffReason {
  if (changeKind === "rename-pure") {
    return "rename-only";
  }
  if (binary) {
    return "binary";
  }
  if (tooLarge) {
    return "too-large";
  }
  if (changeKind === "new") {
    return "new-file";
  }
  if (changeKind === "deleted") {
    return "deleted-file";
  }
  return "no-hunks";
}
