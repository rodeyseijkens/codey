export function patchLooksBinary(patch: string) {
  return (
    /(^|\n)Binary files .* differ(?:\n|$)/.test(patch) ||
    /(^|\n)GIT binary patch(?:\n|$)/.test(patch)
  );
}
