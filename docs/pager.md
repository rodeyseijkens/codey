# codey as a pager and difftool

`codey pager` renders a unified diff from stdin with the same viewer as `codey diff`,
but read-only: stage keys are disabled, and keyboard input is read from `/dev/tty`
while the diff itself is piped in.

## One-off usage

```sh
git diff | codey pager
git show HEAD | codey pager
```

## Wiring as git's pager

```sh
git config --global core.pager "codey pager"
```

Now every paged git command (`git diff`, `git log -p`, `git show`, ...) opens in
codey. Quit with `q`.

If you only want it for diffs, use the diff-specific setting instead:

```sh
git config --global pager.diff "codey pager"
git config --global pager.show "codey pager"
```

## Wiring as a difftool

```sh
git config --global diff.tool codey
git config --global difftool.codey.cmd 'codey diff "$LOCAL" "$REMOTE"'
git config --global difftool.prompt false
```

Then:

```sh
git difftool HEAD          # two-file diff through codey
git difftool HEAD~2 HEAD
```

## Notes

- The pager reads all of stdin first, then takes over the terminal; large diffs are
  subject to the same budgets as diff mode (2 MB / 50k lines per file).
- `Esc`/`q` quit; `j`/`k` scroll, `]`/`[` jump hunks, `?` shows all keys.
- When `codey` is not on PATH, point the config at the launcher directly, e.g.
  `core.pager = "$HOME/Projects/codey/bin/codey pager"`.
