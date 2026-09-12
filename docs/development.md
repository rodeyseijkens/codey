# Developing codey

How to build codey from source, what the project layout looks like, and how it relates to the upstream hunk project. User-facing install and usage instructions live in the [README](../README.md).

## Running from source

Requirements: Node.js 22+ (or Bun) and pnpm for installing dependencies. The project uses pnpm's `supportedArchitectures` to link the native `@opentui/core-*` packages for every target, so install with pnpm rather than bun.

```sh
git clone https://github.com/rodeyseijkens/codey
cd codey
pnpm install

# run with hot reload
bun run dev

# build a standalone binary
bun run build
./bin/codey
```

Binaries are only built for macOS and Linux.

## Project layout

- `src/`: the app. UI components under `src/ui/`, state under `src/state/`, VCS glue under `src/vcs/`, data loaders under `src/loaders/`
- `bin/`: the npm launcher shim (`codey.cjs`) and build output
- `scripts/`: build, bench, and release tooling
- `test/`: bun test suites
- `docs/`: user and maintainer docs

## Checks

```sh
pnpx ultracite fix   # format and lint
pnpm type-check      # tsc --noEmit
bun test             # test suite
```

## Relationship to hunk

`codey` incorporates a modified copy of [`hunk-diff`](https://github.com/modem-dev/hunk/tree/main/packages/hunk-diff) (MIT licensed) for its diff rendering engine, and shares the same [OpenTUI](https://github.com/anomalyco/opentui) foundation. It is not a direct fork of the full hunk application. It adapts the diff renderer for a two-section staged/unstaged review UX with transient comments and a commit log sidebar.

## Releasing

See [releasing.md](releasing.md) for the bootstrap steps and the steady-state pipeline.