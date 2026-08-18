# codey

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)
[![Built on OpenTUI](https://img.shields.io/badge/Built%20on-OpenTUI-orange.svg)](https://github.com/anomalyco/opentui)
[![Uses hunk-diff](https://img.shields.io/badge/Uses-hunk--diff-purple.svg)](https://github.com/modem-dev/hunk/tree/main/packages/hunk-diff)

A review-first Git TUI for agentic coding workflows. Two-section staged/unstaged diff viewer with transient line comments, real git staging, and a commit log sidebar with pull/push and commit creation. Built on [OpenTUI](https://github.com/anomalyco/opentui) and [hunk-diff](https://github.com/modem-dev/hunk/tree/main/packages/hunk-diff).

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

Keys are grouped by the pane they act on, matching the help overlay.

#### Changes Pane

| Key                 | Action                                              |
| ------------------- | --------------------------------------------------- |
| `j` / `k`           | Move selection down / up                            |
| `f` / `F`           | Next / previous file                                |
| `Space`             | Collapse/expand row (section, folder, commit header)|
| `b`                 | Toggle sidebar                                      |
| `t`                 | Toggle sidebar view (tree / list)                   |
| `<` / `>`           | Shrink / grow sidebar                               |
| `a` / `A`           | Stage file / Stage all files                        |
| `u` / `U`           | Unstage file / Unstage all files                    |
| `r`                 | Refresh (reload from git)                           |
| `m`                 | Cycle layout (split / stack / auto)                 |
| `w`                 | Toggle line wrapping                                |

#### Diff Pane

| Key                 | Action                                              |
| ------------------- | --------------------------------------------------- |
| `[` / `]`           | Previous / next hunk                                |
| `Ctrl+f` / `Ctrl+b` | Page down / up                                      |
| `Ctrl+d` / `Ctrl+u` | Half-page down / up                                 |
| `v`                 | Start line/range selection for comments             |
| `c`                 | Add transient comment; in the commit log, open a commit input |
| `d` / `e`           | Delete / edit comment on current line               |
| `n` / `N`           | Next / previous comment                             |
| `s`                 | Send comments (standalone: copy to clipboard)       |
| `y`                 | Copy selection to clipboard                         |

#### Commits Pane

| Key                 | Action                                              |
| ------------------- | --------------------------------------------------- |
| `Tab` / `Shift+Tab` | Cycle focus: changes ↔ diff ↔ commit log           |
| `0` / `1` / `2`     | Focus changes / diff / commit log directly          |
| `p` / `P`           | Pull / push to the remote (commit pane)             |

#### Global

| Key                 | Action                                              |
| ------------------- | --------------------------------------------------- |
| `?`                 | Show help overlay                                   |
| `q`                 | Quit                                                |
| `Esc`               | Cancel overlay                                      |

All keybindings are customizable in `~/.config/codey/config.toml` under `[keybindings]`. Press `?` inside the app for the full live list.

Layouts (`split` / `stack` / `auto`), themes, line numbers, tab width, sidebar view, ignored files, and custom keybindings live in `~/.config/codey/config.toml`.

### Ignoring files in the diff

Lock files and dependency checksums are not loaded into the diff view by default: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `bun.lockb`, `Cargo.lock`, `Gemfile.lock`, `poetry.lock`, `Pipfile.lock`, `go.sum`, `composer.lock`, `Package.resolved`, `packages.lock.json`, `pubspec.lock`, `uv.lock`, `mix.lock`, `deno.lock`, `flake.lock`, `.terraform.lock.hcl`, and `gradle.lockfile`. They still appear in the file list — selecting one shows a placeholder instead of its diff.

Set `ignoreFiles` to **replace** the default list with your own glob patterns. Patterns match the repo-relative path; `*` matches within a path segment, `**` crosses directories, and `?` matches a single character. A pattern without `/` matches that name at any depth. An empty list disables the filter.

```toml
# ~/.config/codey/config.toml
ignoreFiles = ["**/package-lock.json", "**/pnpm-lock.yaml", "**/*.snap"]
```
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
