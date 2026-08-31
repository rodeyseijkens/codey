export type CommandSection =
  | "changes"
  | "diff"
  | "commits"
  | "global"
  | "overlay";

export type CommandDef = {
  defaultKey: string | readonly string[];
  description: string;
  section: CommandSection;
};

export const COMMAND_DEFS = {
  "add-comment": {
    defaultKey: "c",
    description:
      "Add a transient comment on the selected line/range; in the commit log, open a commit input",
    section: "diff",
  },
  cancel: {
    defaultKey: "escape",
    description: "Cancel overlay or pending confirmation",
    section: "global",
  },
  "collapse-section": {
    defaultKey: "space",
    description: "Collapse/expand the selected row (section or folder)",
    section: "changes",
  },
  "commit-move-down": {
    defaultKey: "alt+j",
    description: "Move selected commit down in history (rebase)",
    section: "commits",
  },
  "commit-move-up": {
    defaultKey: "alt+k",
    description: "Move selected commit up in history (rebase)",
    section: "commits",
  },
  copy: {
    defaultKey: "y",
    description: "Copy selection/diff to clipboard",
    section: "diff",
  },
  "delete-comment": {
    defaultKey: "d",
    description: "Delete the comment on the current line",
    section: "diff",
  },
  "diff-search-next": {
    defaultKey: "n",
    description: "Next diff search match",
    section: "diff",
  },
  "diff-search-prev": {
    defaultKey: "shift+n",
    description: "Previous diff search match",
    section: "diff",
  },
  "edit-comment": {
    defaultKey: "e",
    description: "Edit the comment on the current line",
    section: "diff",
  },
  "focus-commits": {
    defaultKey: "2",
    description: "Focus the commit log",
    section: "commits",
  },
  "focus-diff": {
    defaultKey: "0",
    description: "Focus the diff pane",
    section: "commits",
  },
  "focus-prev": {
    defaultKey: "shift+tab",
    description: "Cycle focus to the previous pane",
    section: "commits",
  },
  "focus-sidebar": {
    defaultKey: "1",
    description: "Focus the changes pane",
    section: "commits",
  },
  "focus-toggle": {
    defaultKey: "tab",
    description: "Cycle focus: changes → diff → commits",
    section: "commits",
  },
  "git-edit": {
    defaultKey: "g",
    description: "Edit selected commit (squash/fixup/drop/amend); r for reset",
    section: "commits",
  },
  "git-pull": {
    defaultKey: "p",
    description: "Pull from the remote (commit pane)",
    section: "commits",
  },
  "git-push": {
    defaultKey: "shift+p",
    description: "Push to the remote (commit pane)",
    section: "commits",
  },
  help: {
    defaultKey: "?",
    description: "Show help overlay",
    section: "global",
  },
  "next-comment": {
    defaultKey: "n",
    description: "Jump to next comment",
    section: "diff",
  },
  "next-file": {
    defaultKey: "f",
    description: "Jump to next file",
    section: "changes",
  },
  "next-hunk": {
    defaultKey: "]",
    description: "Jump to next hunk",
    section: "diff",
  },

  // Search commands
  "open-diff-search": {
    defaultKey: "/",
    description: "Open diff search",
    section: "diff",
  },

  // Overlay commands
  "overlay-confirm": {
    defaultKey: ["return", "y"],
    description: "Confirm overlay action",
    section: "overlay",
  },
  "overlay-edit-amend": {
    defaultKey: "a",
    description: "Amend commit with staged changes",
    section: "overlay",
  },
  "overlay-edit-drop": {
    defaultKey: "d",
    description: "Drop commit",
    section: "overlay",
  },
  "overlay-edit-fixup": {
    defaultKey: "f",
    description: "Fixup commit (discard message)",
    section: "overlay",
  },
  "overlay-edit-squash": {
    defaultKey: "s",
    description: "Squash commit into parent",
    section: "overlay",
  },
  "overlay-reset-hard": {
    defaultKey: "h",
    description: "Git reset --hard",
    section: "overlay",
  },
  "overlay-reset-mixed": {
    defaultKey: "m",
    description: "Git reset --mixed",
    section: "overlay",
  },
  "overlay-reset-soft": {
    defaultKey: "s",
    description: "Git reset --soft",
    section: "overlay",
  },
  "overlay-to-reset": {
    defaultKey: "g",
    description: "Switch to reset overlay",
    section: "overlay",
  },
  "overlay-to-reword": {
    defaultKey: "r",
    description: "Reword commit message",
    section: "overlay",
  },
  "page-cursor-half-down": {
    defaultKey: "ctrl+d",
    description: "Move cursor and page half page down",
    section: "diff",
  },
  "page-cursor-half-up": {
    defaultKey: "ctrl+u",
    description: "Move cursor and page half page up",
    section: "diff",
  },
  "page-down": {
    defaultKey: ["ctrl+f", "pagedown"],
    description: "Move page down",
    section: "diff",
  },
  "page-up": {
    defaultKey: ["ctrl+b", "pageup"],
    description: "Move page up",
    section: "diff",
  },
  "prev-comment": {
    defaultKey: "shift+n",
    description: "Jump to previous comment",
    section: "diff",
  },
  "prev-file": {
    defaultKey: "shift+f",
    description: "Jump to previous file",
    section: "changes",
  },
  "prev-hunk": {
    defaultKey: "[",
    description: "Jump to previous hunk",
    section: "diff",
  },
  quit: { defaultKey: "q", description: "Quit codey", section: "global" },
  refresh: {
    defaultKey: "r",
    description: "Reload changesets from git",
    section: "changes",
  },
  "select-next": {
    defaultKey: ["j", "down"],
    description: "Move selection down",
    section: "changes",
  },
  "select-prev": {
    defaultKey: ["k", "up"],
    description: "Move selection up",
    section: "changes",
  },
  "send-comments": {
    defaultKey: "s",
    description: "Send pending comments (standalone: copy to clipboard)",
    section: "diff",
  },
  "sidebar-grow": {
    defaultKey: ">",
    description: "Make the sidebar wider",
    section: "changes",
  },
  "sidebar-shrink": {
    defaultKey: "<",
    description: "Make the sidebar narrower",
    section: "changes",
  },
  "stage-all": {
    defaultKey: "shift+a",
    description: "Stage all changed files",
    section: "changes",
  },
  "stage-file": {
    defaultKey: "a",
    description: "Stage selected file (git add)",
    section: "changes",
  },
  "toggle-layout": {
    defaultKey: "m",
    description: "Cycle layout mode split / stack / auto",
    section: "changes",
  },
  "toggle-sidebar": {
    defaultKey: "b",
    description: "Show/hide the sidebar",
    section: "changes",
  },
  "toggle-view": {
    defaultKey: "t",
    description: "Toggle sidebar view tree / list",
    section: "changes",
  },
  "unstage-all": {
    defaultKey: "shift+u",
    description: "Unstage all staged files",
    section: "changes",
  },
  "unstage-file": {
    defaultKey: "u",
    description: "Unstage selected file (git restore --staged)",
    section: "changes",
  },
  "visual-select": {
    defaultKey: "v",
    description: "Start line/range selection for comments",
    section: "diff",
  },
  "wrap-text": {
    defaultKey: "w",
    description: "Toggle diff line wrapping",
    section: "changes",
  },
} as const satisfies Record<string, CommandDef>;

export type CommandId = keyof typeof COMMAND_DEFS;

export const ALL_COMMANDS = Object.keys(COMMAND_DEFS) as CommandId[];

export const COMMAND_DESCRIPTIONS = Object.fromEntries(
  Object.entries(COMMAND_DEFS).map(([key, def]) => [key, def.description]),
) as Record<CommandId, string>;

export const DEFAULT_KEYBINDINGS = Object.fromEntries(
  Object.entries(COMMAND_DEFS).map(([key, def]) => [key, def.defaultKey]),
) as Record<CommandId, string | readonly string[]>;

const SECTION_TITLES = {
  changes: "Changes",
  commits: "Commits",
  diff: "Diff",
  global: "Global",
  overlay: "Overlays",
};

const sectionEntries = Object.entries(COMMAND_DEFS) as [
  CommandId,
  CommandDef,
][];

const grouped = Object.groupBy(
  sectionEntries,
  ([, def]) => def.section,
) as Record<CommandSection, [CommandId, CommandDef][]>;

export const COMMAND_SECTIONS = (
  ["changes", "diff", "commits", "global", "overlay"] as CommandSection[]
).map((section) => ({
  commands: (grouped[section] ?? []).map(([id]) => id),
  title: SECTION_TITLES[section],
}));
