export type CommandId =
  | "quit"
  | "help"
  | "select-prev"
  | "select-next"
  | "prev-hunk"
  | "next-hunk"
  | "prev-file"
  | "next-file"
  | "focus-toggle"
  | "focus-prev"
  | "focus-sidebar"
  | "focus-diff"
  | "focus-commits"
  | "git-pull"
  | "git-push"
  | "toggle-sidebar"
  | "collapse-section"
  | "sidebar-shrink"
  | "sidebar-grow"
  | "visual-select"
  | "add-comment"
  | "edit-comment"
  | "delete-comment"
  | "next-comment"
  | "prev-comment"
  | "send-comments"
  | "copy"
  | "stage-file"
  | "stage-all"
  | "unstage-file"
  | "unstage-all"
  | "refresh"
  | "toggle-layout"
  | "toggle-view"
  | "page-up"
  | "page-down"
  | "page-cursor-half-up"
  | "page-cursor-half-down"
  | "cancel"
  | "wrap-text"
  | "git-reset"
  | "git-edit";

export const ALL_COMMANDS: readonly CommandId[] = [
  "quit",
  "help",
  "select-prev",
  "select-next",
  "prev-hunk",
  "next-hunk",
  "prev-file",
  "next-file",
  "focus-toggle",
  "focus-prev",
  "focus-sidebar",
  "focus-diff",
  "focus-commits",
  "git-pull",
  "git-push",
  "toggle-sidebar",
  "collapse-section",
  "sidebar-shrink",
  "sidebar-grow",
  "visual-select",
  "add-comment",
  "edit-comment",
  "delete-comment",
  "next-comment",
  "prev-comment",
  "send-comments",
  "copy",
  "stage-file",
  "stage-all",
  "unstage-file",
  "unstage-all",
  "refresh",
  "toggle-layout",
  "toggle-view",
  "page-up",
  "page-down",
  "page-cursor-half-up",
  "page-cursor-half-down",
  "git-reset",
  "git-edit",
] as const;

export const COMMAND_DESCRIPTIONS: Record<CommandId, string> = {
  "add-comment":
    "Add a transient comment on the selected line/range; in the commit log, open a commit input",
  cancel: "Cancel overlay or pending confirmation",
  "collapse-section": "Collapse/expand the selected row (section or folder)",
  copy: "Copy selection/diff to clipboard",
  "delete-comment": "Delete the comment on the current line",
  "edit-comment": "Edit the comment on the current line",
  "focus-commits": "Focus the commit log",
  "focus-diff": "Focus the diff pane",
  "focus-prev": "Cycle focus to the previous pane",
  "focus-sidebar": "Focus the changes pane",
  "focus-toggle": "Cycle focus: changes → diff → commits",
  "git-edit": "Edit selected commit (squash/fixup/drop/amend)",
  "git-pull": "Pull from the remote (commit pane)",
  "git-push": "Push to the remote (commit pane)",
  "git-reset": "Reset to selected commit (mixed/soft/hard)",
  help: "Show help overlay",
  "next-comment": "Jump to next comment",
  "next-file": "Jump to next file",
  "next-hunk": "Jump to next hunk",
  "page-cursor-half-down": "Move cursor and page half page down",
  "page-cursor-half-up": "Move cursor and page half page up",
  "page-down": "Move page down",
  "page-up": "Move page up",
  "prev-comment": "Jump to previous comment",
  "prev-file": "Jump to previous file",
  "prev-hunk": "Jump to previous hunk",
  quit: "Quit codey",
  refresh: "Reload changesets from git",
  "select-next": "Move selection down",
  "select-prev": "Move selection up",
  "send-comments": "Send pending comments (standalone: copy to clipboard)",
  "sidebar-grow": "Make the sidebar wider",
  "sidebar-shrink": "Make the sidebar narrower",
  "stage-all": "Stage all changed files",
  "stage-file": "Stage selected file (git add)",
  "toggle-layout": "Cycle layout mode split / stack / auto",
  "toggle-sidebar": "Show/hide the sidebar",
  "toggle-view": "Toggle sidebar view tree / list",
  "unstage-all": "Unstage all staged files",
  "unstage-file": "Unstage selected file (git restore --staged)",
  "visual-select": "Start line/range selection for comments",
  "wrap-text": "Toggle diff line wrapping",
};

export const DEFAULT_KEYBINDINGS: Record<CommandId, string> = {
  "add-comment": "c",
  cancel: "escape",
  "collapse-section": "space",
  copy: "y",
  "delete-comment": "d",
  "edit-comment": "e",
  "focus-commits": "2",
  "focus-diff": "0",
  "focus-prev": "shift+tab",
  "focus-sidebar": "1",
  "focus-toggle": "tab",
  "git-edit": "e",
  "git-pull": "p",
  "git-push": "P",
  "git-reset": "g",
  help: "?",
  "next-comment": "n",
  "next-file": "f",
  "next-hunk": "]",
  "page-cursor-half-down": "ctrl+d",
  "page-cursor-half-up": "ctrl+u",
  "page-down": "ctrl+f",
  "page-up": "ctrl+b",
  "prev-comment": "N",
  "prev-file": "F",
  "prev-hunk": "[",
  quit: "q",
  refresh: "r",
  "select-next": "j",
  "select-prev": "k",
  "send-comments": "s",
  "sidebar-grow": ">",
  "sidebar-shrink": "<",
  "stage-all": "A",
  "stage-file": "a",
  "toggle-layout": "m",
  "toggle-sidebar": "b",
  "toggle-view": "t",
  "unstage-all": "U",
  "unstage-file": "u",
  "visual-select": "v",
  "wrap-text": "w",
};

export const COMMAND_SECTIONS: ReadonlyArray<{
  commands: readonly CommandId[];
  title: string;
}> = [
  {
    commands: [
      "select-prev",
      "select-next",
      "next-file",
      "prev-file",
      "collapse-section",
      "toggle-sidebar",
      "toggle-view",
      "sidebar-shrink",
      "sidebar-grow",
      "stage-file",
      "stage-all",
      "unstage-file",
      "unstage-all",
      "refresh",
      "toggle-layout",
      "wrap-text",
    ],
    title: "Changes",
  },
  {
    commands: [
      "prev-hunk",
      "next-hunk",
      "page-up",
      "page-down",
      "page-cursor-half-up",
      "page-cursor-half-down",
      "visual-select",
      "add-comment",
      "edit-comment",
      "delete-comment",
      "next-comment",
      "prev-comment",
      "send-comments",
      "copy",
    ],
    title: "Diff",
  },
  {
    commands: [
      "focus-toggle",
      "focus-prev",
      "focus-sidebar",
      "focus-diff",
      "focus-commits",
      "git-pull",
      "git-push",
      "git-reset",
      "git-edit",
    ],
    title: "Commits",
  },
  {
    commands: ["quit", "help", "cancel"],
    title: "Global",
  },
];
