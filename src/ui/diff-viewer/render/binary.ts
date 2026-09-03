const binaryFileRegex = /(^|\n)Binary files .* differ(?:\n|$)/;
const gitBinaryPatchRegex = /(^|\n)GIT binary patch(?:\n|$)/;

export function patchLooksBinary(patch: string) {
  return binaryFileRegex.test(patch) || gitBinaryPatchRegex.test(patch);
}
