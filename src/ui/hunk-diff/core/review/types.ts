export type ReviewSide = "old" | "new";
export type ReviewLineRange = readonly [number, number];
export type ReviewFileChangeKind =
  | "change"
  | "rename-pure"
  | "rename-changed"
  | "new"
  | "deleted";

export interface ReviewLineAddressV1 {
  side: ReviewSide;
  line: number;
}
