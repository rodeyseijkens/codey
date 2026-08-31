import type { KeyEvent, Renderable } from "@opentui/core";
import type {
  KeyAfterInputContext,
  KeyInputContext,
  Keymap,
  ReactiveMatcher,
} from "@opentui/keymap";
import {
  registerEnabledFields,
  registerMetadataFields,
} from "@opentui/keymap/addons";
import { reactiveMatcherFromStore } from "@opentui/keymap/react";

import {
  cancelCommitDraft,
  cancelRewordDraft,
  closeOverlay,
} from "../state/actions/drafts";
import { cancelPendingStage } from "../state/actions/staging";
import { dispatchCommand } from "../state/command-registry";
import { cancelCommentDraft } from "../state/comment-actions";
import {
  acceptDiffSearch,
  closeDiffSearch,
  diffSearchNext,
  diffSearchPrev,
  setDiffSearchQuery,
} from "../state/search-actions";
import type { Store } from "../state/store";
import {
  COMMAND_DEFS,
  COMMAND_SECTIONS,
  type CommandId,
  DEFAULT_KEYBINDINGS,
} from "./commands";

const STAGE_COMMANDS: ReadonlySet<string> = new Set([
  "stage-file",
  "stage-all",
  "unstage-file",
  "unstage-all",
]);

const CONFIRM_OVERLAY_KINDS = new Set([
  "confirm-force-push",
  "confirm-discard",
  "confirm-discard-all",
  "confirm-commit-all",
]);

function mergedKeys(
  command: CommandId,
  overrides: Record<string, string>,
): string[] {
  const override = overrides[command];
  if (override !== undefined) {
    return [override];
  }
  const def = DEFAULT_KEYBINDINGS[command];
  if (Array.isArray(def)) {
    return def as unknown as string[];
  }
  return [def as string];
}

function expandKeys(
  cmd: string,
  keys: string[],
): { key: string; cmd: string; desc: string; group: string }[] {
  const def = COMMAND_DEFS[cmd as CommandId];
  const desc = def?.description ?? "";
  const group =
    COMMAND_SECTIONS.find((s) => s.commands.includes(cmd as CommandId))
      ?.title ?? "Global";
  return keys.map((key) => ({ cmd, desc, group, key }));
}

function allNormalCommandsBindings(
  overrides: Record<string, string>,
): ReturnType<typeof expandKeys> {
  const result: ReturnType<typeof expandKeys> = [];
  const all = COMMAND_DEFS as Record<
    string,
    (typeof COMMAND_DEFS)[keyof typeof COMMAND_DEFS]
  >;
  for (const cmd of Object.keys(all)) {
    const def = all[cmd];
    if (def?.section === "overlay") {
      continue;
    }
    const keys = mergedKeys(cmd as CommandId, overrides);
    result.push(...expandKeys(cmd, keys));
  }
  return result;
}

function layerEnabled(
  store: Store,
  predicate: (state: ReturnType<Store["getState"]>) => boolean,
): ReactiveMatcher {
  return reactiveMatcherFromStore(store.subscribe, () =>
    predicate(store.getState()),
  );
}

export function registerAppLayers(
  keymap: Keymap<Renderable, KeyEvent>,
  store: Store,
  overrides: Record<string, string>,
): () => void {
  const disposers: (() => void)[] = [];

  const offEnabled = registerEnabledFields(keymap);
  disposers.push(offEnabled);

  const offMetadata = registerMetadataFields(keymap);
  disposers.push(offMetadata);

  const allNormalBindings = allNormalCommandsBindings(overrides);

  const offNormal = keymap.registerLayer({
    bindings: allNormalBindings.map((b) => ({
      cmd: b.cmd,
      desc: b.desc,
      group: b.group,
      key: b.key,
    })),
    commands: Object.keys(COMMAND_DEFS).map((name) => ({
      desc: COMMAND_DEFS[name as CommandId]?.description ?? "",
      group:
        COMMAND_SECTIONS.find((s) => s.commands.includes(name as CommandId))
          ?.title ?? "Global",
      name,
      run() {
        dispatchCommand(name as CommandId);
        return true;
      },
    })),
    priority: 0,
  });
  disposers.push(offNormal);

  const offStage = keymap.registerLayer({
    bindings: [
      {
        cmd: "cancel",
        desc: "Cancel pending stage",
        group: "Changes",
        key: "escape",
      },
      ...Array.from(STAGE_COMMANDS).flatMap((cmd) => {
        const keys = mergedKeys(cmd as CommandId, overrides);
        return expandKeys(cmd, keys);
      }),
    ].map((b) => ({ cmd: b.cmd, desc: b.desc, group: b.group, key: b.key })),
    enabled: layerEnabled(store, (s) => s.pendingStage !== null),
    priority: 10,
  });
  disposers.push(offStage);

  const offStageKeyAfter = keymap.intercept(
    "key:after",
    (ctx: KeyAfterInputContext<Renderable, KeyEvent>) => {
      const s = store.getState();
      if (!s.pendingStage) {
        return;
      }
      if (s.diffSearch?.open) {
        return;
      }
      if (
        ctx.reason === "binding-handled" ||
        ctx.reason === "intercept-consumed"
      ) {
        return;
      }
      cancelPendingStage();
    },
  );
  disposers.push(offStageKeyAfter);

  const offDraft = keymap.registerLayer({
    bindings: [
      { cmd: "cancel", desc: "Cancel draft", group: "Global", key: "escape" },
    ],
    commands: [
      {
        desc: "Cancel draft or overlay",
        group: "Global",
        name: "cancel",
        run() {
          const state = store.getState();
          if (state.commitDraft !== null) {
            cancelCommitDraft();
          } else if (state.commentDraft) {
            cancelCommentDraft();
          }
          return true;
        },
      },
    ],
    enabled: layerEnabled(
      store,
      (s) => s.commitDraft !== null || s.commentDraft !== null,
    ),
    priority: 20,
  });
  disposers.push(offDraft);

  const offReword = keymap.registerLayer({
    bindings: [
      { cmd: "cancel", desc: "Cancel reword", group: "Global", key: "escape" },
    ],
    commands: [
      {
        desc: "Cancel reword draft",
        group: "Global",
        name: "cancel",
        run() {
          cancelRewordDraft();
          return true;
        },
      },
    ],
    enabled: layerEnabled(store, (s) => s.rewordDraft !== null),
    priority: 40,
  });
  disposers.push(offReword);

  const offOverlayDismiss = keymap.registerLayer({
    bindings: [
      {
        cmd: "cancel",
        desc: "Dismiss overlay",
        group: "Global",
        key: "escape",
      },
    ],
    commands: [
      {
        desc: "Dismiss overlay",
        group: "Global",
        name: "cancel",
        run() {
          closeOverlay();
          return true;
        },
      },
    ],
    enabled: layerEnabled(store, (s) => s.overlay !== null),
    priority: 30,
  });
  disposers.push(offOverlayDismiss);

  const offOverlayConfirm = keymap.registerLayer({
    bindings: (() => {
      const keys = mergedKeys("overlay-confirm" as CommandId, overrides);
      return expandKeys("overlay-confirm", keys).map((b) => ({
        cmd: b.cmd,
        desc: b.desc,
        group: b.group,
        key: b.key,
      }));
    })(),
    commands: [
      {
        desc: "Confirm overlay action",
        group: "Overlays",
        name: "overlay-confirm",
        run() {
          dispatchCommand("overlay-confirm");
          return true;
        },
      },
    ],
    enabled: layerEnabled(store, (s) => {
      const o = s.overlay;
      return o !== null && CONFIRM_OVERLAY_KINDS.has(o.kind);
    }),
    priority: 30,
  });
  disposers.push(offOverlayConfirm);

  const offOverlayReset = keymap.registerLayer({
    bindings: [
      "overlay-reset-mixed",
      "overlay-reset-soft",
      "overlay-reset-hard",
    ].flatMap((cmd: string) => {
      const keys = mergedKeys(cmd as CommandId, overrides);
      return expandKeys(cmd, keys).map((b) => ({
        cmd: b.cmd,
        desc: b.desc,
        group: b.group,
        key: b.key,
      }));
    }),
    enabled: layerEnabled(store, (s) => {
      const o = s.overlay;
      return o !== null && o.kind === "reset-commits";
    }),
    priority: 30,
  });
  disposers.push(offOverlayReset);

  const offOverlayEdit = keymap.registerLayer({
    bindings: [
      "overlay-edit-squash",
      "overlay-edit-fixup",
      "overlay-edit-drop",
      "overlay-edit-amend",
      "overlay-to-reword",
      "overlay-to-reset",
    ].flatMap((cmd: string) => {
      const keys = mergedKeys(cmd as CommandId, overrides);
      return expandKeys(cmd, keys).map((b) => ({
        cmd: b.cmd,
        desc: b.desc,
        group: b.group,
        key: b.key,
      }));
    }),
    enabled: layerEnabled(store, (s) => {
      const o = s.overlay;
      return o !== null && o.kind === "edit-commit";
    }),
    priority: 30,
  });
  disposers.push(offOverlayEdit);

  const offDiffSearch = keymap.registerLayer({
    bindings: [
      {
        cmd: "cancel",
        desc: "Close diff search",
        group: "Diff",
        key: "escape",
      },
    ].concat(
      ["diff-search-next", "diff-search-prev"].flatMap((cmd: string) => {
        const keys = mergedKeys(cmd as CommandId, overrides);
        return expandKeys(cmd, keys).map((b) => ({
          cmd: b.cmd,
          desc: b.desc,
          group: b.group,
          key: b.key,
        }));
      }),
    ),
    commands: [
      {
        desc: "Close diff search",
        group: "Diff",
        name: "cancel",
        run() {
          closeDiffSearch();
          return true;
        },
      },
      {
        desc: "Next diff search match",
        group: "Diff",
        name: "diff-search-next",
        run() {
          diffSearchNext();
          return true;
        },
      },
      {
        desc: "Previous diff search match",
        group: "Diff",
        name: "diff-search-prev",
        run() {
          diffSearchPrev();
          return true;
        },
      },
    ],
    enabled: layerEnabled(
      store,
      (s) => s.diffSearch !== null && !s.diffSearch.open && s.focus === "diff",
    ),
    priority: 50,
  });
  disposers.push(offDiffSearch);

  const offDiffSearchIntercept = keymap.intercept(
    "key",
    (ctx: KeyInputContext<KeyEvent>) => {
      const s = store.getState();
      if (!s.diffSearch?.open || s.focus !== "diff") {
        return;
      }
      const { name } = ctx.event;
      switch (name) {
        case "escape":
          closeDiffSearch();
          ctx.consume();
          break;
        case "enter":
        case "return":
          void acceptDiffSearch();
          ctx.consume();
          break;
        case "backspace":
          setDiffSearchQuery(s.diffSearch.query.slice(0, -1));
          ctx.consume();
          break;
        case "space":
          setDiffSearchQuery(`${s.diffSearch.query} `);
          ctx.consume();
          break;
        default:
          if (!(ctx.event.ctrl || ctx.event.meta) && name.length === 1) {
            setDiffSearchQuery(s.diffSearch.query + name);
            ctx.consume();
          }
          break;
      }
    },
  );
  disposers.push(offDiffSearchIntercept);

  return () => {
    for (const dispose of disposers.reverse()) {
      dispose();
    }
  };
}
