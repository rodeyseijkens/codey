# codey keybindings

All keys are remappable via the `[keybindings]` table in `~/.config/codey/config.toml`.
Chord grammar: `ctrl+`, `alt+`, `shift+` modifiers plus a key, e.g. `ctrl+s`, `alt+j`.
A single uppercase letter means shift (e.g. `A` = `shift+a`).

The keybindings table is validated as a whole file: an unknown command, an invalid
chord, or two commands bound to the same chord invalidates the entire table (and the
whole config), and codey shows an error pane until the file is fixed.

## Defaults

Keys are grouped by the pane they act on, matching the help overlay.

### Changes Pane

| Key     | Command          | Description                                              |
| ------- | ---------------- | -------------------------------------------------------- |
| `j`     | select-next      | Move selection down (changes/commit list; diff row)      |
| `k`     | select-prev      | Move selection up                                        |
| `f`     | next-file        | Jump to next file (diff pane; commit log files)          |
| `F`     | prev-file        | Jump to previous file (diff pane; commit log files)      |
| `space` | collapse-section | Collapse/expand the selected row (section/folder/commit header, load more) |
| `b`     | toggle-sidebar   | Show/hide the sidebar                                    |
| `t`     | toggle-view      | Toggle sidebar view: tree → list → tree                  |
| `<`     | sidebar-shrink   | Make the sidebar narrower                                |
| `>`     | sidebar-grow     | Make the sidebar wider                                   |
| `a`     | stage-file       | Stage selected file (`git add <file>`)                   |
| `A`     | stage-all        | Stage all changed files                                  |
| `u`     | unstage-file     | Unstage selected file (`git restore --staged <file>`); discards working-tree changes in the changes scope |
| `U`     | unstage-all      | Unstage all staged files; discards all working-tree changes in the changes scope |
| `r`     | refresh          | Reload changesets from git                               |
| `m`     | toggle-layout    | Cycle layout mode: split → stack → auto                  |
| `w`     | wrap-text        | Toggle diff line wrapping                                |

### Diff Pane

| Key     | Command          | Description                                              |
| ------- | ---------------- | -------------------------------------------------------- |
| `]`     | next-hunk        | Jump to next hunk (diff pane)                            |
| `[`     | prev-hunk        | Jump to previous hunk (diff pane)                        |
| `ctrl+f`| page-down        | Move page down (diff pane)                               |
| `ctrl+b`| page-up          | Move page up (diff pane)                                 |
| `ctrl+d`| page-cursor-half-down | Move cursor and page half page down (diff pane)       |
| `ctrl+u`| page-cursor-half-up | Move cursor and page half page up (diff pane)         |
| `v`     | visual-select    | Start line/range selection for comments                  |
| `c`     | add-comment      | Add a transient comment on the selected line/range; in the commit log, open a commit input |
| `e`     | edit-comment     | Edit the comment on the current line                     |
| `d`     | delete-comment   | Delete the comment on the current line                   |
| `n`     | next-comment     | Jump to next comment                                     |
| `N`     | prev-comment     | Jump to previous comment                                 |
| `s`     | send-comments    | Send pending comments (standalone: copy to clipboard)    |
| `y`     | copy             | Copy selected file's diff to clipboard                   |

### Commits Pane

| Key      | Command          | Description                                              |
| -------- | ---------------- | -------------------------------------------------------- |
| `j`      | select-next      | Move cursor down (commit headers and file rows)          |
| `k`      | select-prev      | Move cursor up                                           |
| `f`      | next-file        | Jump cursor to next commit file row                      |
| `F`      | prev-file        | Jump cursor to previous commit file row                  |
| `space`  | collapse-section | Expand/collapse commit header (or load-more row)         |
| `tab`    | focus-toggle     | Cycle focus: changes → diff → commits                    |
| `shift+tab` | focus-prev    | Cycle focus the other way                                |
| `0`      | focus-diff       | Focus the diff pane                                      |
| `1`      | focus-sidebar    | Focus the changes pane (re-shows the sidebar)            |
| `2`      | focus-commits    | Focus the commit log (re-shows the sidebar)              |
| `g`      | git-edit         | Edit selected commit (squash/fixup/drop/amend); `r` for reset |
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

## Sidebar view

The sidebar shows the staged and changed files either as a flat **list** or as a
collapsible **tree** (folders grouped). The default is the tree view. Configure the
initial view in `~/.config/codey/config.toml`:

```toml
view = "list"   # or "tree" (default)
```

or pass `--view list` / `--view tree` on the command line. Toggle at runtime with `t`.

Every row — the `Staged`/`Changes` headers, folders, and files — is selectable
with `j`/`k` (or the arrow keys) or a mouse click. Press `space` on a header or
folder to collapse/expand it. Files open in the diff pane when selected.

## Commit log pane

The commit log at the bottom of the sidebar is focusable with `tab` (or `2`).
While the commit pane is focused:

- `j`/`k` navigate a flat list of commit headers and (when expanded) their files.
  The cursor stops at the top/bottom — it does not wrap around.
- `space` on a commit header expands/collapses its file list; `space` on a file
  row does nothing.
- Moving the cursor onto a file row opens its diff in the diff pane (focus stays
  on the commit log). A cursor on a commit header keeps the last-shown diff.
- `f`/`F` jump the cursor between commit file rows (forward/backward), opening
  each diff; they stop at the first/last commit file.
- The `load more` row loads the next page only when you explicitly press `space`
  (or click it); after loading, the cursor jumps to the first newly added commit.

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

Guard: staging a file that still has pending unsent comments warns first
(`N comment(s) will be cleared — press again to confirm`). Pressing a stage key again
confirms and clears those comments; `Esc` cancels.

## Sidebar visibility

While the sidebar is hidden (`b`), focus is always the diff pane and `tab` stays
there. Pressing `1` or `2` re-shows the sidebar and focuses the changes or commit
log; `0` focuses the diff without re-showing it. Reopening with `b` focuses the
pane the currently-shown file comes from: a commit diff returns to the commit
log, otherwise the changes pane.

## Remapping example

```toml
# ~/.config/codey/config.toml
[keybindings]
stage-file = "ctrl+a"
stage-all = "ctrl+shift+a"
quit = "ctrl+q"
```
