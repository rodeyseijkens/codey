# codey | Work In Progress

Review-first git TUI: a two-section staged/changes diff viewer with transient
line comments and real git staging. Built on [OpenTUI](https://github.com/anomalyco/opentui).

`codey` sits beside your agent while it writes code — review the diff it just
produced, comment on lines, stage the parts you want, and hand the notes back.
It runs standalone in any terminal, as a [herdr](https://herdr.dev) plugin pane,
and as git's pager or difftool.

## Install

```sh
# standalone
bun install -g codey            # or pnpm add -g codey

# as a herdr plugin
herdr plugin install codey
herdr plugin action invoke open --plugin codey
```

Requirements: Node.js 22+, macOS or Linux, and git for `diff`/`show` mode.

## Quick start

```sh
codey diff          # review staged + unstaged changes (default command)
codey show HEAD~1   # review a revision, read-only
codey patch file.diff   # or `git diff | codey patch -`
git diff | codey pager  # read-only pager over a piped diff
```

- `Tab` moves between the two diff sections (staged / changes) and the sidebar.
- `c` comments on the selected line or range; comments are transient and don't
  touch your working tree.
- `s` stages the selected hunk, `u` unstages — real git staging, not a preview.
- `?` shows every keybinding, `r` refreshes, `--watch` auto-reloads on changes.
- `q` quits.

Layouts (`split` / `stack` / `auto`), themes, line numbers, tab width, sidebar
view, and custom keybindings live in `~/.config/codey/config.toml`.

## Docs

- [docs/pager.md](docs/pager.md) — wire `codey` as git's pager or difftool.
- [docs/keybindings.md](docs/keybindings.md) — the full keymap.

## Related projects

- [herdr-reviewr](https://github.com/persiyanov/herdr-reviewr) — a code-review +
  file-viewer sidebar for herdr: comment on an agent's diff, send it back, plus a
  read-only view of the PR, its checks, and comments.
- [hunk](https://github.com/modem-dev/hunk) — a review-first terminal diff viewer
  for agentic coders: multi-file review stream, inline AI annotations, and Git /
  Jujutsu / Sapling support, also built on OpenTUI.

## License

MIT
