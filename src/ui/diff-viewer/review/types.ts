export type ReviewSide = "old" | "new";
export type ReviewLineRange = readonly [number, number];
export type ReviewFileChangeKind =
  | "change"
  | "rename-pure"
  | "rename-changed"
  | "new"
  | "deleted";

export type ReviewLineAddressV1 = {
  line: number;
  side: ReviewSide;
};

export function reviewExpansionSide(
  changeKind: ReviewFileChangeKind,
): ReviewSide {
  return changeKind === "deleted" ? "old" : "new";
}
