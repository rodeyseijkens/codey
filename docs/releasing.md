# Releasing codey

This documents the one-time npm bootstrap and the steady-state release pipeline.

## Pipeline overview

| Event | Workflow | What happens |
| ----- | -------- | ------------ |
| PR opened / pushed | `ci.yml` | lint, type-check, tests, launcher build, `linux-x64` compile sanity check |
| Push to `main` | `release.yml` | release-please bumps the version, updates `CHANGELOG.md`, `package.json`, `herdr-plugin.toml` and `src/main.tsx` (via inline `x-release-please-version` markers), opens a release PR |
| Release PR merged | `release.yml` → `publish.yml` | release-please creates the `vX.Y.Z` tag + GitHub Release, then chains `publish.yml` via `workflow_call` (releases created by `GITHUB_TOKEN` don't fire `on: release` events): builds 6 platform binaries, smoke-tests each, publishes 7 npm packages (`@rodey-io/codey` + 6 `@rodey-io/codey-<target>`), uploads the `.tar.gz` assets to the release |

Users install with `npm i -g @rodey-io/codey` — the npm package is a thin Node
shim (`bin/codey.mjs`) that spawns the prebuilt binary from the matching
`@rodey-io/codey-<os>-<arch>[-musl]` platform package. No bun, no runtime deps.

## One-time bootstrap (v0.1.0)

Steps 1–7 are manual and never repeated.

1. **Create the npm org.** Sign in at <https://npmjs.com> and create the
   `rodey-io` organization. The scope `@rodey-io` must exist before publishing
   (`codey` and `@rodey` are both taken; npm scopes cannot be domains).

2. **Merge the implementation PR** (the one that adds `scripts/release/`,
   `bin/codey.mjs`, the workflows, and this doc).

3. **Add a temporary npm token secret.** Create a granular access token on npm
   with publish access to the `rodey-io` org, then add it to the repo as
   `NPM_TOKEN` (Settings → Secrets and variables → Actions).

4. **Create the release-please baseline tag.** release-please versions from the
   last tag; with no tags it would scan all history. Create the first release at
   current `main`:

   ```sh
   gh release create v0.1.0 --generate-notes
   ```

5. **Publish the bootstrap release.**

   ```sh
   gh workflow run publish.yml --ref main -f version=0.1.0
   ```

   The `build` job cross-compiles all 6 binaries, `smoke` verifies
   `codey --version` on every target except darwin-x64 (macos-13 runners sit in
   queues indefinitely; the darwin-x64 binary is still built and published), and
   `publish` runs `scripts/release/publish.ts`, which:

   - stages 6 platform packages under `dist/publish/<target>/`
     (`@rodey-io/codey-<os>-<arch>[-musl]`, binary only) plus the root package
     (`@rodey-io/codey`, shim + pinned `optionalDependencies`);
   - `npm publish --access public --provenance` each platform package, then the
     root package (auth via the `NPM_TOKEN` secret this one time);
   - uploads the six `codey-<version>-<target>.tar.gz` assets to
     `v0.1.0` via `gh release upload ... --clobber`.

   This bootstrap works because trusted publishing can only be configured on
   packages that already exist.

6. **Configure trusted publishing (OIDC).** On npmjs.com, for **all seven**
   packages (`rodey-io/codey`, `rodey-io/codey-darwin-arm64`,
   `rodey-io/codey-darwin-x64`, `rodey-io/codey-linux-x64`,
   `rodey-io/codey-linux-arm64`, `rodey-io/codey-linux-x64-musl`,
   `rodey-io/codey-linux-arm64-musl`): Access → Publish access, add a new
   publisher with:

   - Provider: GitHub
   - Repository: `rodeyseijkens/codey`
   - Workflow: `publish.yml`
   - Environments: (leave default)

7. **Remove the throwaway credential.** Delete the `NPM_TOKEN` repo secret and
   expire the npm token. All future publishes use OIDC only — no token anywhere.

8. **Verify on a clean machine.**

   ```sh
   npm i -g @rodey-io/codey && codey --version
   ```

   Repeat on an Alpine container (after `apk add libstdc++ libgcc`) and on
   macOS. The TUI should launch.

9. **Verify the herdr flow.** `herdr plugin install <git url>` still clones,
   builds via `herdr/build.sh` (bun required there), and `codey herdr
   <toggle|open|close|auto-open>` opens the pane.

## Steady state (v0.1.1+)

Nothing manual:

1. Conventional commits land on `main` (`feat:` → minor, `fix:` → patch).
2. release-please opens `chore(main): release ...` PRs. Merge one.
3. Merging creates the tag + GitHub Release, which triggers `publish.yml`
   (OIDC-only this time).
4. Users `npm update -g @rodey-io/codey`.

## Troubleshooting

- **`bun build --compile` can't resolve `@opentui/core-*`** — the native
  packages for all targets must be installed. `pnpm-workspace.yaml` declares
  `supportedArchitectures` (os `darwin`/`linux`, cpu `x64`/`arm64`, libc
  `glibc`/`musl`), so `pnpm install` links all six alongside `@opentui/core`.
- **`npm publish` provenance error** — the `id-token: write` permission or the
  workflow-level OIDC configuration on npmjs.com is missing. See step 6.
- **`npm publish` ENEEDAUTH** — OIDC trusted publishing needs npm CLI ≥ 11.5.1
  (the publish job pins node 24 for this). Also check each package's trusted
  publisher on npmjs.com allows direct `npm publish` — configurations created
  after 2026-09-03 default to stage-publish only.
- **`gh release upload` fails** — the tag `v<version>` must already exist
  (created by release-please, or manually for the bootstrap).
- **Darwin cross-compile breaks in CI** — the smoke matrix gates the publish;
  the fallback is moving the two darwin legs onto `macos-*` runners.
