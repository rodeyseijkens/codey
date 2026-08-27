import { resolveOverlayKey } from "../src/state/overlay-controller";
import { describe, expect, test } from "bun:test";

const confirmOverlays = [
  { kind: "confirm-force-push" as const },
  {
    bulk: false,
    kind: "confirm-discard" as const,
    paths: ["a.ts"],
    scope: "changes" as const,
  },
  { kind: "confirm-discard-all" as const },
  { kind: "confirm-commit-all" as const, message: "test" },
];

describe("resolveOverlayKey", () => {
  for (const overlay of confirmOverlays) {
    describe(`${overlay.kind}`, () => {
      test("y accepts", () => {
        expect(resolveOverlayKey("y", null, overlay)).toEqual({
          kind: overlay.kind,
        });
      });

      test("enter accepts", () => {
        expect(resolveOverlayKey("enter", null, overlay)).toEqual({
          kind: overlay.kind,
        });
      });

      test("return accepts", () => {
        expect(resolveOverlayKey("return", null, overlay)).toEqual({
          kind: overlay.kind,
        });
      });

      test("escape cancels (dismisses)", () => {
        expect(resolveOverlayKey("escape", null, overlay)).toEqual({
          kind: "dismiss",
        });
      });

      test("cancel command dismisses", () => {
        expect(resolveOverlayKey("c", "cancel", overlay)).toEqual({
          kind: "dismiss",
        });
      });

      test("unrelated key returns null", () => {
        expect(resolveOverlayKey("x", null, overlay)).toBeNull();
      });
    });
  }

  describe("reset-commits", () => {
    const overlay = { hash: "abc123", kind: "reset-commits" as const };

    test("m triggers mixed reset", () => {
      expect(resolveOverlayKey("m", null, overlay)).toEqual({
        kind: "git-reset",
        mode: "mixed",
      });
    });

    test("s triggers soft reset", () => {
      expect(resolveOverlayKey("s", null, overlay)).toEqual({
        kind: "git-reset",
        mode: "soft",
      });
    });

    test("h triggers hard reset", () => {
      expect(resolveOverlayKey("h", null, overlay)).toEqual({
        kind: "git-reset",
        mode: "hard",
      });
    });

    test("escape dismisses", () => {
      expect(resolveOverlayKey("escape", null, overlay)).toEqual({
        kind: "dismiss",
      });
    });

    test("unrelated key returns null", () => {
      expect(resolveOverlayKey("x", null, overlay)).toBeNull();
    });
  });

  describe("edit-commit", () => {
    const overlay = { hash: "abc123", kind: "edit-commit" as const };

    test("s triggers squash", () => {
      expect(resolveOverlayKey("s", null, overlay)).toEqual({
        action: "squash",
        kind: "git-edit",
      });
    });

    test("f triggers fixup", () => {
      expect(resolveOverlayKey("f", null, overlay)).toEqual({
        action: "fixup",
        kind: "git-edit",
      });
    });

    test("d triggers drop", () => {
      expect(resolveOverlayKey("d", null, overlay)).toEqual({
        action: "drop",
        kind: "git-edit",
      });
    });

    test("a triggers amend", () => {
      expect(resolveOverlayKey("a", null, overlay)).toEqual({
        action: "amend",
        kind: "git-edit",
      });
    });

    test("r switches to reset overlay", () => {
      expect(resolveOverlayKey("r", null, overlay)).toEqual({
        kind: "switch-to-reset",
      });
    });

    test("escape dismisses", () => {
      expect(resolveOverlayKey("escape", null, overlay)).toEqual({
        kind: "dismiss",
      });
    });

    test("unrelated key returns null", () => {
      expect(resolveOverlayKey("x", null, overlay)).toBeNull();
    });
  });

  describe("help overlay", () => {
    const overlay = { kind: "help" as const };

    test("escape dismisses", () => {
      expect(resolveOverlayKey("escape", null, overlay)).toEqual({
        kind: "dismiss",
      });
    });

    test("cancel command dismisses", () => {
      expect(resolveOverlayKey("c", "cancel", overlay)).toEqual({
        kind: "dismiss",
      });
    });

    test("other keys return null (handled by component)", () => {
      expect(resolveOverlayKey("j", null, overlay)).toBeNull();
    });
  });
});
