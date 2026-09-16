# codey

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)
[![Built on OpenTUI](https://img.shields.io/badge/Built%20on-OpenTUI-orange.svg)](https://github.com/anomalyco/opentui)

A review-first Git TUI for agentic coding workflows. Two-section staged/unstaged diff viewer with transient line comments, real git staging, and a commit log sidebar with pull/push and commit creation. Built on [OpenTUI](https://github.com/anomalyco/opentui) and [hunk-diff](https://github.com/modem-dev/hunk/tree/main/packages/hunk-diff).

`codey` sits beside your agent while it writes code. Review the diff it just produced, comment on lines, stage the parts you want, and hand the notes back. It runs standalone in any terminal and as a [herdr](https://herdr.dev) plugin pane.

---

## Installation

Install globally from npm. A prebuilt binary for your platform is fetched automatically, so **no bun and no Node dependencies are required at runtime.**

```sh
npm install -g @rodey-io/codey

# or with bun's faster installer
bun add -g @rodey-io/codey

codey
```

The npm package ships a small JS shim plus prebuilt binaries for macOS (arm64, x64) and Linux (x64, arm64, glibc and musl), published as `@rodey-io/codey-<os>-<arch>[-musl]` platform packages. On Alpine Linux (musl) the binary needs a couple of system libraries:

```sh
apk add libstdc++ libgcc
```

You can also install manually from the [GitHub Releases](https://github.com/rodeyseijkens/codey/releases) page. Download the `codey-<version>-<os>-<arch>[-musl].tar.gz` asset for your platform, extract it, and put the `codey` binary on your `PATH`.

### As a herdr plugin (recommended for agentic workflows)

```sh
# Install from GitHub (downloads the matching release binary)
herdr plugin install rodeyseijkens/codey

# Open the pane
herdr plugin action invoke open --plugin codey
```

> herdr clones the repo and runs `herdr/build.sh`, which installs the standalone GitHub Release binary for this platform into the plugin directory. If no prebuilt exists, it installs deps and compiles a standalone binary from source (requires bun, and pnpm for OpenTUI native packages).

---

## Getting started

Run `codey` in a repository. The default view splits your staged and unstaged changes into two sections. Press `?` for the full key list.

A first pass through the app:

1. Move through the sidebar rows with `j`/`k` and open a file's diff in the diff pane.
2. Stage changes with `a` (current file) or `A` (all of them). Unstage with `u`/`U`.
3. Comment on a line or range: `v` to start a selection, `c` to add a comment, `s` to send.
4. Commit: focus the commit log with `2`, press `c`, type the message, then Enter.
5. Pull and push from the commit pane with `p` and `P`.

`Esc` cancels overlays; `q` quits.

### Keybindings (defaults)

Keys are grouped by the pane they act on, matching the help overlay.

#### Changes Pane

| Key       | Action                                               |
| --------- | ---------------------------------------------------- |
| `j` / `k` | Move selection down / up                             |
| `f` / `F` | Next / previous file                                 |
| `Space`   | Collapse/expand row (section, folder)                |
| `b`       | Toggle sidebar                                       |
| `t`       | Toggle sidebar view (tree / list)                    |
| `<` / `>` | Shrink / grow sidebar                                |
| `a` / `A` | Stage file / Stage all files                         |
| `E`       | Open the selected file in `$EDITOR` (same terminal)  |
| `u` / `U` | Unstage staged file / Unstage all staged files; discard working-tree changes from the changes scope |
| `r`       | Refresh (reload from git)                            |
| `m`       | Cycle layout (split / stack / auto)                  |
| `w`       | Toggle line wrapping                                 |

#### Diff Pane

| Key                 | Action                                                        |
| ------------------- | ------------------------------------------------------------- |
| `[` / `]`           | Previous / next hunk                                          |
| `Ctrl+f` / `Ctrl+b` | Page down / up                                                |
| `Ctrl+d` / `Ctrl+u` | Half-page down / up                                           |
| `v`                 | Start line/range selection for comments                       |
| `c`                 | Add transient comment; in the commit log, open a commit input |
| `d` / `e`           | Delete / edit comment on current line                         |
| `E`                 | Open the shown file in `$EDITOR` (same terminal)              |
| `n` / `N`           | Next / previous comment                                       |
| `s`                 | Send comments (standalone: copy to clipboard)                 |
| `y`                 | Copy selection to clipboard                                   |

#### Commits Pane

| Key           | Action                                                        |
| ------------- | ------------------------------------------------------------- |
| `j` / `k`     | Move selection down / up                                      |
| `f` / `F`     | Next / previous file                                          |
| `Space`       | Expand/collapse commit                                        |
| `c`           | Open commit input                                             |
| `p` / `P`     | Pull / push to the remote                                     |
| `g`           | Edit selected commit (squash/fixup/drop/amend/reword/reset) |
| `E`           | Open the file row under the cursor in `$EDITOR`             |
| `Alt+j` / `Alt+k` | Reorder commit up / down in history (interactive rebase)  |

#### Global

| Key                 | Action                                     |
| ------------------- | ------------------------------------------ |
| `Tab` / `Shift+Tab` | Cycle focus: changes ↔ diff ↔ commit log   |
| `0` / `1` / `2`     | Focus changes / diff / commit log directly |
| `?`                 | Show help overlay                          |
| `q`                 | Quit                                       |
| `Esc`               | Cancel overlay                             |

All keybindings are customizable in `~/.config/codey/config.toml` under `[keybindings]`. Press `?` inside the app for the full live list.

### Configuration

Layouts (`split` / `stack` / `auto`), themes, line numbers, tab width, sidebar view, ignored files, the file editor, and custom keybindings live in `~/.config/codey/config.toml`.

Set `theme` to any bundled theme id, or leave it at `auto` for the default theme. See [Themes](docs/themes.md) for the list.

```toml
# ~/.config/codey/config.toml
theme = "tokyo-night"
```

`E` opens the focused file in the same terminal. Set `editor` to pick the program; otherwise codey uses `$VISUAL`, then `$EDITOR`, then `vi`.

```toml
# ~/.config/codey/config.toml
editor = "nvim"
```

### Ignoring files in the diff

Lock files and dependency checksums are not loaded into the diff view by default: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `bun.lockb`, `Cargo.lock`, `Gemfile.lock`, `poetry.lock`, `Pipfile.lock`, `go.sum`, `composer.lock`, `Package.resolved`, `packages.lock.json`, `pubspec.lock`, `uv.lock`, `mix.lock`, `deno.lock`, `flake.lock`, `.terraform.lock.hcl`, and `gradle.lockfile`. They still appear in the file list: selecting one shows a placeholder instead of its diff.

Set `ignoreFiles` to **replace** the default list with your own glob patterns. Patterns match the repo-relative path; `*` matches within a path segment, `**` crosses directories, and `?` matches a single character. A pattern without `/` matches that name at any depth. An empty list disables the filter.

```toml
# ~/.config/codey/config.toml
ignoreFiles = ["**/package-lock.json", "**/pnpm-lock.yaml", "**/*.snap"]
```

---

## Documentation

- [Keybindings](docs/keybindings.md): full keymap reference
- [Themes](docs/themes.md): supported themes and how to set them
- [Development](docs/development.md): running from source, building, layout
- [Releasing](docs/releasing.md): the release pipeline

---

## License

[MIT](LICENSE). Copyright (c) Rodey Seijkens; includes modified code from [`hunk-diff`](https://github.com/modem-dev/hunk/tree/main/packages/hunk-diff) (MIT, Copyright Modem)

---

## Related Projects

- [hunk](https://github.com/modem-dev/hunk): the upstream project, a multi-file review stream with inline AI annotations and Git/Jujutsu/Sapling support
- [herdr-reviewr](https://github.com/persiyanov/herdr-reviewr): a code-review sidebar for herdr, letting you comment on agent diffs, send them back, and view PR checks/comments
- [OpenTUI](https://github.com/anomalyco/opentui): the TUI framework powering both projects