// Shared release-target definitions used by build-binaries.ts and publish.ts.

export const NPM_SCOPE = "@rodey-io";
export const ROOT_PACKAGE = `${NPM_SCOPE}/codey`;

export type TargetName =
  | "darwin-arm64"
  | "darwin-x64"
  | "linux-x64"
  | "linux-arm64"
  | "linux-x64-musl"
  | "linux-arm64-musl";

export type ReleaseTarget = {
  /** Target triple, e.g. "linux-x64-musl". Used for bun compile target and artifact names. */
  target: TargetName;
  os: "darwin" | "linux";
  cpu: "x64" | "arm64";
  libc: "glibc" | "musl" | null;
};

export const RELEASE_TARGETS: ReleaseTarget[] = [
  { cpu: "arm64", libc: null, os: "darwin", target: "darwin-arm64" },
  { cpu: "x64", libc: null, os: "darwin", target: "darwin-x64" },
  { cpu: "x64", libc: "glibc", os: "linux", target: "linux-x64" },
  { cpu: "arm64", libc: "glibc", os: "linux", target: "linux-arm64" },
  { cpu: "x64", libc: "musl", os: "linux", target: "linux-x64-musl" },
  { cpu: "arm64", libc: "musl", os: "linux", target: "linux-arm64-musl" },
];

export function platformPackageName(t: ReleaseTarget): string {
  return `${ROOT_PACKAGE}-${t.target}`;
}

export function findTarget(name: string): ReleaseTarget | undefined {
  return RELEASE_TARGETS.find((t) => t.target === name);
}

export function bunCompileTarget(t: ReleaseTarget): Bun.Build.CompileTarget {
  return `bun-${t.target}`;
}
