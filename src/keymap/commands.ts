export type CommandId =
  | "quit"
  | "help"
  | "palette"
  | "select-prev"
  | "select-next"
  | "prev-hunk"
  | "next-hunk"
  | "prev-file"
  | "next-file"
  | "focus-toggle"
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
  | "list-comments"
  | "send-comments"
  | "copy"
  | "stage-file"
  | "stage-all"
  | "unstage-file"
  | "unstage-all"
  | "refresh"
  | "toggle-layout"
  | "toggle-view"
  | "cancel";

export const ALL_COMMANDS: readonly CommandId[] = [
  "quit",
  "help",
  "palette",
  "select-prev",
  "select-next",
  "prev-hunk",
  "next-hunk",
  "prev-file",
  "next-file",
  "focus-toggle",
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
  "list-comments",
  "send-comments",
  "copy",
  "stage-file",
  "stage-all",
  "unstage-file",
  "unstage-all",
  "refresh",
  "toggle-layout",
  "toggle-view",
] as const;

export const COMMAND_DESCRIPTIONS: Record<CommandId, string> = {
  "add-comment": "Add a transient comment on the selected line/range",
  cancel: "Cancel overlay or pending confirmation",
  "collapse-section": "Collapse/expand the selected row (section or folder)",
  copy: "Copy selection/diff to clipboard",
  "delete-comment": "Delete the comment on the current line",
  "edit-comment": "Edit the comment on the current line",
  "focus-toggle": "Toggle focus between sidebar and diff pane",
  help: "Show help overlay",
  "list-comments": "List pending comments for the current file",
  "next-comment": "Jump to next comment",
  "next-file": "Jump to next file",
  "next-hunk": "Jump to next hunk",
  palette: "Open command palette",
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
};

export const DEFAULT_KEYBINDINGS: Record<CommandId, string> = {
  "add-comment": "c",
  cancel: "escape",
  "collapse-section": "space",
  copy: "y",
  "delete-comment": "d",
  "edit-comment": "e",
  "focus-toggle": "tab",
  help: "?",
  "list-comments": "l",
  "next-comment": "n",
  "next-file": "f",
  "next-hunk": "]",
  palette: "/",
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
  "toggle-sidebar": "p",
  "toggle-view": "t",
  "unstage-all": "U",
  "unstage-file": "u",
  "visual-select": "v",
};
