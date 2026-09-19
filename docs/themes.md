# codey themes

A theme in codey is one id that colors the whole app: the sidebar, overlays and
bottom bar, the diff row tints and `+`/`-` sign colors, and the syntax
highlighting of the code itself. There is no separate UI vs. code theme.

## Setting a theme

Set the default in `~/.config/codey/config.toml`:

```toml
# ~/.config/codey/config.toml
theme = "tokyo-night"
```

Or override it for one run:

```sh
codey --theme tokyo-night
```

The default is `theme = "auto"`.

## Automatic mode

`auto` uses codey's default theme, `github-dark-default`. codey does not detect
the terminal background, so a light terminal keeps the dark default until a
light theme is set explicitly.

## Any Shiki theme id

codey ships the full bundled Shiki theme collection and the first-party Pierre
themes (all listed below). Any id from that collection is accepted: codey
resolves the id through Shiki and derives the app chrome, diff tints and panel
colors from the theme's own editor background, foreground and git decoration
colors, so a theme does not need a hand-tuned entry to work across the app.

An id that Shiki does not know (including a typo, or a theme from a collection
codey does not bundle) falls back to the `auto` default rather than failing.

## Removed theme ids

Earlier codey releases shipped their own theme ids. They still resolve, mapped to
the closest bundled theme:

| Old id     | Resolves to            |
| ---------- | ---------------------- |
| `ember`    | `dark-plus`            |
| `graphite` | `github-dark-default`  |
| `midnight` | `github-dark-dimmed`   |
| `paper`    | `github-light-default` |
| `zenburn`  | `everforest-dark`      |

## Bundled Shiki themes

65 themes from [`@shikijs/themes`](https://shiki.style/themes).

| Theme                             | Appearance |
| --------------------------------- | ---------- |
| `andromeeda`                      | dark       |
| `aurora-x`                        | dark       |
| `ayu-dark`                        | dark       |
| `ayu-light`                       | light      |
| `ayu-mirage`                      | dark       |
| `catppuccin-frappe`               | dark       |
| `catppuccin-latte`                | light      |
| `catppuccin-macchiato`            | dark       |
| `catppuccin-mocha`                | dark       |
| `dark-plus`                       | dark       |
| `dracula`                         | dark       |
| `dracula-soft`                    | dark       |
| `everforest-dark`                 | dark       |
| `everforest-light`                | light      |
| `github-dark`                     | dark       |
| `github-dark-default`             | dark       |
| `github-dark-dimmed`              | dark       |
| `github-dark-high-contrast`       | dark       |
| `github-light`                    | light      |
| `github-light-default`            | light      |
| `github-light-high-contrast`      | light      |
| `gruvbox-dark-hard`               | dark       |
| `gruvbox-dark-medium`             | dark       |
| `gruvbox-dark-soft`               | dark       |
| `gruvbox-light-hard`              | light      |
| `gruvbox-light-medium`            | light      |
| `gruvbox-light-soft`              | light      |
| `horizon`                         | dark       |
| `horizon-bright`                  | light      |
| `houston`                         | dark       |
| `kanagawa-dragon`                 | dark       |
| `kanagawa-lotus`                  | light      |
| `kanagawa-wave`                   | dark       |
| `laserwave`                       | dark       |
| `light-plus`                      | light      |
| `material-theme`                  | dark       |
| `material-theme-darker`           | dark       |
| `material-theme-lighter`          | light      |
| `material-theme-ocean`            | dark       |
| `material-theme-palenight`        | dark       |
| `min-dark`                        | dark       |
| `min-light`                       | light      |
| `monokai`                         | dark       |
| `night-owl`                       | dark       |
| `night-owl-light`                 | light      |
| `nord`                            | dark       |
| `one-dark-pro`                    | dark       |
| `one-light`                       | light      |
| `plastic`                         | dark       |
| `poimandres`                      | dark       |
| `red`                             | dark       |
| `rose-pine`                       | dark       |
| `rose-pine-dawn`                  | light      |
| `rose-pine-moon`                  | dark       |
| `slack-dark`                      | dark       |
| `slack-ochin`                     | light      |
| `snazzy-light`                    | light      |
| `solarized-dark`                  | dark       |
| `solarized-light`                 | light      |
| `synthwave-84`                    | dark       |
| `tokyo-night`                     | dark       |
| `vesper`                          | dark       |
| `vitesse-black`                   | dark       |
| `vitesse-dark`                    | dark       |
| `vitesse-light`                   | light      |

## Bundled Pierre themes

10 first-party themes from [`@pierre/theme`](https://github.com/pierrecomputer/pierre).
The `vibrant` variants declare Display-P3 token colors; codey converts them to
sRGB so they render correctly in a terminal.

| Theme                                    | Appearance |
| ---------------------------------------- | ---------- |
| `pierre-dark`                            | dark       |
| `pierre-dark-protanopia-deuteranopia`    | dark       |
| `pierre-dark-soft`                       | dark       |
| `pierre-dark-tritanopia`                 | dark       |
| `pierre-dark-vibrant`                    | dark       |
| `pierre-light`                           | light      |
| `pierre-light-protanopia-deuteranopia`   | light      |
| `pierre-light-soft`                      | light      |
| `pierre-light-tritanopia`                | light      |
| `pierre-light-vibrant`                   | light      |

## Related

- [Keybindings](keybindings.md)
- [Development](development.md)
- [Releasing](releasing.md)
