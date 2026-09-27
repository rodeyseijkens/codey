# codey keybindings

All keys are remappable via the `[keybindings]` table in `~/.config/codey/config.toml`.
Chord grammar: `ctrl+`, `alt+`, `shift+` modifiers plus a key, e.g. `ctrl+s`, `alt+j`.
A single uppercase letter means shift (e.g. `A` = `shift+a`).

The keybindings table is validated per-layer: an unknown command or an invalid
chord invalidates the entire table (and the whole config), and codey shows an error
pane until the file is fixed. Collisions are legal across layers (e.g. `s` binds
different commands in the reset-commits vs edit-commit overlays).

## Defaults

Keys are grouped by the pane they act on, matching the help overlay.

### Changes Pane

| Key     | Command          | Description                                              |
| ------- | ---------------- | -------------------------------------------------------- |
| `j`     | select-next      | Move selection down (changes/commit list; diff row)      |
| `k`     | select-prev      | Move selection up                                        |
| `f`     | next-file        | Jump to next file (diff pane; commit log files)          |
| `F`     | prev-file        | Jump to previous file (diff pane; commit log files)      |
| `space` | collapse-section | Collapse/expand the selected row (section, folder, commit header/dir, load more) |
| `b`     | toggle-sidebar   | Show/hide the sidebar                                    |
| `t`     | toggle-view      | Toggle tree/list view for the focused pane (changes or commits) |
| `<`     | sidebar-shrink   | Make the sidebar narrower (also `shift+left` or `shift+h`) |
| `>`     | sidebar-grow     | Make the sidebar wider (also `shift+right` or `shift+l`) |
| `a`     | stage-file       | Stage selected file (`git add <file>`)                   |
| `E`     | edit-file        | Open the selected file in `$EDITOR` (same terminal)      |
| `shift+a` | stage-all      | Stage all changed files                                  |
| `u`     | unstage-file     | Unstage selected file (`git restore --staged <file>`); discards working-tree changes in the changes scope |
| `shift+u` | unstage-all   | Cursor-aware: unstage all staged files when the cursor is in the staged section; otherwise discard all working-tree changes in the changes scope |
| `r`     | refresh          | Reload changesets from git                               |
| `m`     | toggle-layout    | Cycle layout mode: split → stack → auto                  |
| `w`     | wrap-text        | Toggle diff line wrapping                                |
| —       | toggle-folders   | Collapse all tree folders in the focused pane (expand all when all collapsed); unbound by default |

### Diff Pane

| Key      | Command                | Description                                              |
| -------- | ---------------------- | -------------------------------------------------------- |
| `]`      | next-hunk              | Jump to next hunk                                        |
| `[`      | prev-hunk              | Jump to previous hunk                                    |
| `ctrl+f` | page-down              | Move page down                                           |
| `ctrl+b` | page-up                | Move page up                                             |
| `ctrl+d` | page-cursor-half-down  | Move cursor and page half page down                      |
| `ctrl+u` | page-cursor-half-up    | Move cursor and page half page up                        |
| `v`      | visual-select          | Start line/range selection for comments                  |
| `c`      | add-comment            | Add a transient comment on the selected line/range; in the commit log, open a commit input |
| `e`      | edit-comment           | Edit the comment on the current line                     |
| `E`      | edit-file              | Open the shown file in `$EDITOR` (same terminal)         |
| `d`      | delete-comment         | Delete the comment on the current line                   |
| `n`      | next-comment           | Jump to next comment                                     |
| `N`      | prev-comment           | Jump to previous comment                                 |
| `s`      | send-comments          | Send pending comments (standalone: copy to clipboard)    |
| `y`      | copy                   | Copy selected file's diff to clipboard                   |
| `/`      | open-diff-search       | Open diff search                                         |
| `n`      | diff-search-next       | Next diff search match (when diff search is closed)      |
| `N`      | diff-search-prev       | Previous diff search match (when diff search is closed)  |

### Commits Pane

| Key      | Command          | Description                                              |
| -------- | ---------------- | -------------------------------------------------------- |
| `j`      | select-next      | Move cursor down (commit headers, folders, and file rows) |
| `k`      | select-prev      | Move cursor up                                           |
| `f`      | next-file        | Jump cursor to next commit file row                      |
| `F`      | prev-file        | Jump cursor to previous commit file row                  |
| `space`  | collapse-section | Expand/collapse commit header or folder (or load-more row) |
| `t`      | toggle-view      | Toggle the commit file list between tree and list        |
| `shift+up` | commit-taller  | Make the commit pane taller (also `shift+k`)             |
| `shift+down` | commit-shorter | Make the commit pane shorter (also `shift+j`)          |
| `tab`    | focus-toggle     | Cycle focus: changes → diff → commits                    |
| `shift+tab` | focus-prev    | Cycle focus the other way                                |
| `0`      | focus-diff       | Focus the diff pane                                      |
| `1`      | focus-sidebar    | Focus the changes pane (re-shows the sidebar)            |
| `2`      | focus-commits    | Focus the commit log (re-shows the sidebar)              |
| `g`      | git-edit         | Edit selected commit (squash/fixup/drop/amend/reword/reset) |
| `E`      | edit-file        | Open the file row under the cursor in `$EDITOR`           |
| `p`      | git-pull         | Pull from the remote (commit pane only)                  |
| `P`      | git-push         | Push to the remote (commit pane only)                    |
| `alt+j`  | commit-move-down | Move selected commit down in history (interactive rebase)|
| `alt+k`  | commit-move-up   | Move selected commit up in history (interactive rebase)  |

### Global

| Key     | Command          | Description                                              |
| ------- | ---------------- | -------------------------------------------------------- |
| `q`     | quit             | Quit codey                                               |
| `?`     | help             | Show help overlay                                        |
| `esc`   | cancel           | Cancel overlay or pending confirmation                   |

### Overlays

| Key              | Command              | Description                                        |
| ---------------- | -------------------- | -------------------------------------------------- |
| `esc`            | cancel               | Dismiss current overlay                            |
| `y` / `return`   | overlay-confirm      | Confirm action (force-push, discard, commit-all)   |
| `m` / `s` / `h`  | overlay-reset-*      | Reset mode: mixed, soft, hard                      |
| `s` / `f` / `d` / `a` | overlay-edit-*  | Edit commit: squash, fixup, drop, amend            |
| `r`              | overlay-to-reword    | Switch to reword mode                              |
| `g`              | overlay-to-reset     | Switch to reset overlay                            |

## Sidebar view

The sidebar shows the staged and changed files either as a flat **list** or as a
collapsible **tree** (folders grouped). The default is the tree view. Configure the
initial view in `~/.config/codey/config.toml`:

```toml
changesFileView = "list"   # or "tree" (default)
```

or pass `--view list` / `--view tree` on the command line. Toggle at runtime with `t`.

Every row — the `Staged`/`Changes` headers, folders, and files — is selectable
with `j`/`k` (or the arrow keys) or a mouse click. Press `space` on a header or
folder to collapse/expand it. Files open in the diff pane when selected.

The sidebar's top border hosts three clickable controls: a collapse-folders icon
(tree view only), the current view icon (`t`), and a refresh icon (`r`). The
collapse-folders control and the same action are also available as the
`toggle-folders` command, which ships unbound — remap it via `[keybindings]`
(see the remapping example below). `toggle-view` and `toggle-folders` act on the
focused pane: in the sidebar they manage the changes tree, in the commit log
they manage the commit file trees.

## Commit log pane

The commit log at the bottom of the sidebar is focusable with `tab` (or `2`).
While the commit pane is focused:

- `j`/`k` navigate commit headers and, when a commit is expanded, its folder
  rows (tree view) and file rows. The cursor stops at the top/bottom — it does
  not wrap around.
- `space` on a commit header expands/collapses its file list; `space` on a
  folder row collapses/expands that folder; `space` on a file row does nothing.
- Moving the cursor onto a file row opens its diff in the diff pane (focus stays
  on the commit log). A cursor on a commit header or folder keeps the
  last-shown diff.
- `f`/`F` jump the cursor between commit file rows (forward/backward), opening
  each diff; they stop at the first/last commit file.
- The `load more` row loads the next page only when you explicitly press `space`
  (or click it); after loading, the cursor jumps to the first newly added commit.

### Commit file views

Each expanded commit shows its files either as a flat **list** or as a
collapsible **tree** — the same grouping used by the sidebar, including
single-directory chain folding (`src/ui` renders as one node). The default is
the list view; set `commitFilesView = "tree"` in `config.toml` to start in the
tree view. Each commit remembers its own collapsed folders
independently.

- Toggle with `t` (while the commit pane is focused) or the view icon on the
  commit pane's top border.
- Collapse every folder of the expanded commits with the border's
  collapse-folders icon (tree view only), or bind the focus-aware
  `toggle-folders` command.
- Renamed and copied files are listed at their destination path with an `R`/`C`
  status letter.

The commit pane's top border hosts two clickable controls: a collapse-folders
icon (tree view only) and the current view icon. The pane's height is adjustable:

- Drag the pane's top border up or down with the mouse; the height clamps
  between 4 and 40 rows.
- Press `shift+up` / `shift+k` to grow the pane and `shift+down` / `shift+j` to
  shrink it, two rows at a time.
- Set the initial height with `commitHeight` in `config.toml` (4–40, default 12).

### Committing

With the commit pane focused, `c` opens a commit-message input overlay. Enter
creates a commit from the currently staged changes (`git commit -m "..."`).

- If nothing is staged but working-tree changes exist, codey shows a second
  dialog — *Commit all working-tree changes?* — that stages everything
  (`git add -A`) and commits on confirmation.
- If there is nothing to commit at all, an info toast explains so.
- `Esc` cancels the commit input at any point.
- `Ctrl+C` clears the commit message but keeps the input open. The same
  applies to the comment draft and any other input field: while a field is
  active, `Ctrl+C` clears it instead of quitting codey (`Ctrl+C` still quits
  outside input fields).

The commit cursor survives a refresh (`r`) as long as its commit hash still
exists; otherwise it resets to the first row.

The help overlay (`?`) is scrollable with `j`/`k`, the arrow keys, and
`PageUp`/`PageDown`.

## Stage keys (`a` / `A` / `u` / `U`)

Staging is real `git add` against the index — it mutates your repository. In the
changes scope `u`/`U` opens a confirm-discard dialog that runs `git restore` and
`rm` to drop working-tree changes. These keys are exclusive to `codey diff`
(two-group mode); in `show`, two-file, `patch`, and `pager` modes they are disabled
with a hint toast.

`U` (`unstage-all`) is cursor-aware: with the cursor anywhere in the staged
section it unstages every staged file; anywhere else it opens the discard-all
confirmation for all working-tree changes (falling back to unstaging when there
are no working-tree changes).

Guard: staging a file that still has pending unsent comments warns first
(`N comment(s) will be cleared — press again to confirm`). Pressing a stage key again
confirms and clears those comments; `Esc` cancels.

## Sidebar visibility

While the sidebar is hidden (`b`), focus is always the diff pane and `tab` stays
there. Pressing `1` or `2` re-shows the sidebar and focuses the changes or commit
log; `0` focuses the diff without re-showing it. Reopening with `b` focuses the
pane the currently-shown file comes from: a commit diff returns to the commit
log, otherwise the changes pane.

## Opening files in an editor

`E` (`edit-file`) suspends codey and opens the focused file in the same terminal,
then resumes and refreshes when the editor exits. The program is taken from
`editor` in `~/.config/codey/config.toml` if set, otherwise `$VISUAL`, then
`$EDITOR`, then `vi`.

```toml
# ~/.config/codey/config.toml
editor = "nvim"
```

## Remapping example

```toml
# ~/.config/codey/config.toml
[keybindings]
stage-file = "ctrl+a"
stage-all = "ctrl+shift+a"
quit = "ctrl+q"
```
