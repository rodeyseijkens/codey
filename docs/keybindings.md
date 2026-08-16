# codey keybindings

All keys are remappable via the `[keybindings]` table in `~/.config/codey/config.toml`.
Chord grammar: `ctrl+`, `alt+`, `shift+` modifiers plus a key, e.g. `ctrl+s`, `alt+j`.
A single uppercase letter means shift (e.g. `A` = `shift+a`).

The keybindings table is validated as a whole file: an unknown command, an invalid
chord, or two commands bound to the same chord invalidates the entire table (and the
whole config), and codey shows an error pane until the file is fixed.

## Defaults

| Key     | Command          | Description                                              |
| ------- | ---------------- | -------------------------------------------------------- |
| `q`     | quit             | Quit codey                                               |
| `?`     | help             | Show help overlay                                        |
| `j`     | select-next      | Move selection down (changes/commit list; diff row)      |
| `k`     | select-prev      | Move selection up                                        |
| `]`     | next-hunk        | Jump to next hunk (diff pane)                            |
| `[`     | prev-hunk        | Jump to previous hunk (diff pane)                        |
| `f`     | next-file        | Jump to next file (diff pane)                            |
| `F`     | prev-file        | Jump to previous file (diff pane)                        |
| `tab`   | focus-toggle     | Cycle focus: changes → diff → commits                    |
| `shift+tab` | focus-prev    | Cycle focus the other way                                |
| `0`     | focus-sidebar    | Focus the changes pane (re-shows the sidebar)            |
| `1`     | focus-diff       | Focus the diff pane                                      |
| `2`     | focus-commits    | Focus the commit log (re-shows the sidebar)              |
| `p`     | toggle-sidebar   | Show/hide the sidebar                                    |
| `space` | collapse-section | Collapse/expand the selected row (section/folder/commit header, load more) |
| `<`     | sidebar-shrink   | Make the sidebar narrower                                |
| `>`     | sidebar-grow     | Make the sidebar wider                                   |
| `v`     | visual-select    | Start line/range selection for comments                  |
| `c`     | add-comment      | Add a transient comment on the selected line/range       |
| `e`     | edit-comment     | Edit the comment on the current line                     |
| `d`     | delete-comment   | Delete the comment on the current line                   |
| `n`     | next-comment     | Jump to next comment                                     |
| `N`     | prev-comment     | Jump to previous comment                                 |
| `s`     | send-comments    | Send pending comments (standalone: copy to clipboard)    |
| `y`     | copy             | Copy selected file's diff to clipboard                   |
| `a`     | stage-file       | Stage selected file (`git add <file>`)                   |
| `A`     | stage-all        | Stage all changed files                                  |
| `u`     | unstage-file     | Unstage selected file (`git restore --staged <file>`)    |
| `U`     | unstage-all      | Unstage all staged files                                 |
| `r`     | refresh          | Reload changesets from git                               |
| `m`     | toggle-layout    | Cycle layout mode: split → stack → auto                  |
| `w`     | wrap-text        | Toggle diff line wrapping                                |
| `t`     | toggle-view      | Toggle sidebar view: tree → list → tree                  |
| `ctrl+b`| page-up          | Move page up (diff pane)                                 |
| `ctrl+f`| page-down        | Move page down (diff pane)                               |
| `ctrl+u`| page-cursor-half-up | Move cursor and page half page up (diff pane)         |
| `ctrl+d`| page-cursor-half-down | Move cursor and page half page down (diff pane)       |
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
- The `load more` row loads the next page only when you explicitly press `space`
  (or click it); after loading, the cursor jumps to the first newly added commit.

The commit cursor survives a refresh (`r`) as long as its commit hash still
exists; otherwise it resets to the first row.

The help overlay (`?`) is scrollable with `j`/`k`, the arrow keys, and
`PageUp`/`PageDown`.

## Stage keys (`a` / `A` / `u` / `U`)

Staging is real `git add` against the index — it mutates your repository. These keys
are exclusive to `codey diff` (two-group mode); in `show`, two-file, `patch`, and
`pager` modes they are disabled with a hint toast.

Guard: staging a file that still has pending unsent comments warns first
(`N comment(s) will be cleared — press again to confirm`). Pressing a stage key again
confirms and clears those comments; `Esc` cancels.

## Sidebar visibility

While the sidebar is hidden (`p`), focus is always the diff pane and `tab` stays
there. Pressing `0` or `2` re-shows the sidebar and focuses the changes or commit
log; `1` focuses the diff without re-showing it. Reopening with `p` focuses the
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
