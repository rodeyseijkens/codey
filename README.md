# codey

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)
[![Built on OpenTUI](https://img.shields.io/badge/Built%20on-OpenTUI-orange.svg)](https://github.com/anomalyco/opentui)
[![Uses hunk-diff](https://img.shields.io/badge/Uses-hunk--diff-purple.svg)](https://github.com/modem-dev/hunk/tree/main/packages/hunk-diff)

A review-first Git TUI for agentic coding workflows. Two-section staged/unstaged diff viewer with transient line comments, real git staging, and a commit log sidebar. Built on [OpenTUI](https://github.com/anomalyco/opentui) and [hunk-diff](https://github.com/modem-dev/hunk/tree/main/packages/hunk-diff).

`codey` sits beside your agent while it writes code — review the diff it just produced, comment on lines, stage the parts you want, and hand the notes back. It runs standalone in any terminal and as a [herdr](https://herdr.dev) plugin pane.

---

## Installation

`codey` is **not published to npm**. Install via herdr (which builds from source) or run directly with bun.

### As a herdr plugin (recommended)

```sh
# Install from the git repository (builds locally)
herdr plugin install https://github.com/rodeyseijkens/codey

# Open the pane
herdr plugin action invoke open --plugin codey
```

> herdr clones the repo, runs `bun run build`, and installs the `codey` and `codey-herdr` binaries into its plugin directory.

### Standalone (development)

```sh
# Clone and run directly
git clone https://github.com/rodeyseijkens/codey
cd codey
bun install
bun run dev              # runs src/main.tsx with hot reload

# Or build a standalone binary
bun run build
./bin/codey
```

**Requirements:** Node.js 22+ (or Bun), macOS or Linux, and Git for staging operations.

---

## Running

```sh
# Development (with hot reload)
bun run dev

# Build and run standalone binary
bun run build
./bin/codey

# As a herdr plugin
herdr plugin install https://github.com/rodeyseijkens/codey
herdr plugin action invoke open --plugin codey
```

The default command opens the staged/unstaged diff viewer. Press `?` inside for keybindings.

### Keybindings (defaults)

| Key                 | Action                                        |
| ------------------- | --------------------------------------------- |
| `j` / `k`           | Move selection down / up                      |
| `Tab`               | Toggle focus between sidebar and diff pane    |
| `c`                 | Add transient comment on selected line/range  |
| `v`                 | Start line/range selection for comments       |
| `a` / `A`           | Stage file / Stage all files                  |
| `u` / `U`           | Unstage file / Unstage all files              |
| `d` / `e`           | Delete / edit comment on current line         |
| `n` / `N`           | Next / previous comment                       |
| `[` / `]`           | Previous / next hunk                          |
| `f` / `F`           | Next / previous file                          |
| `?`                 | Show help overlay                             |
| `r`                 | Refresh (reload from git)                     |
| `q`                 | Quit                                          |
| `m`                 | Cycle layout (split / stack / auto)           |
| `p`                 | Toggle sidebar                                |
| `t`                 | Toggle sidebar view (tree / list)             |
| `>` / `<`           | Grow / shrink sidebar                         |
| `y`                 | Copy selection to clipboard                   |
| `s`                 | Send comments (standalone: copy to clipboard) |
| `w`                 | Toggle line wrapping                          |
| `Space`             | Collapse/expand section                       |
| `Esc`               | Cancel overlay                                |
| `Ctrl+f` / `Ctrl+b` | Page down / up                                |
| `Ctrl+d` / `Ctrl+u` | Half-page down / up                           |
All keybindings are customizable in `~/.config/codey/config.toml` under `[keybindings]`. Press `?` inside the app for the full live list.

Layouts (`split` / `stack` / `auto`), themes, line numbers, tab width, sidebar view, and custom keybindings live in `~/.config/codey/config.toml`.
---

## Documentation

- [Keybindings](docs/keybindings.md) — Full keymap reference

---
## Relationship to hunk

`codey` incorporates a **modified copy of [`hunk-diff`](https://github.com/modem-dev/hunk/tree/main/packages/hunk-diff)** (MIT licensed) for its diff rendering engine, and shares the same [OpenTUI](https://github.com/anomalyco/opentui) foundation. It is not a direct fork of the full hunk application — rather, it adapts the diff renderer for a two-section staged/unstaged review UX with transient comments and a commit log sidebar.

---

## License

[MIT](LICENSE) — Copyright (c) Rodey Seijkens; includes modified code from [`hunk-diff`](https://github.com/modem-dev/hunk/tree/main/packages/hunk-diff) (MIT, Copyright Modem)

---

## Related Projects 

- [hunk](https://github.com/modem-dev/hunk) — The upstream project: multi-file review stream, inline AI annotations, Git/Jujutsu/Sapling support
- [herdr-reviewr](https://github.com/persiyanov/herdr-reviewr) — Code-review sidebar for herdr: comment on agent diffs, send back, view PR checks/comments
- [OpenTUI](https://github.com/anomalyco/opentui) — The TUI framework powering both projects
