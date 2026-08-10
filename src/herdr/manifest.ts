import { parse } from "smol-toml";
import { z } from "zod";

export const PLUGIN_ID = "codey";
export const PLUGIN_NAME = "codey";
export const PLUGIN_VERSION = "0.1.0";

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
}

export const PLUGIN_METADATA: PluginMetadata = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  version: PLUGIN_VERSION,
};

export const MANIFEST_PATH = new URL("../../herdr-plugin.toml", import.meta.url)
  .pathname;

const CommandSpec = z.object({
  command: z.array(z.string()).min(1),
});

const PaneSpec = CommandSpec.extend({
  id: z.string().min(1),
  placement: z.enum(["overlay", "split", "tab", "zoomed"]).default("overlay"),
  title: z.string().min(1).optional(),
});

const ActionSpec = CommandSpec.extend({
  contexts: z.array(z.string()).min(1).optional(),
  id: z.string().min(1),
  title: z.string().min(1).optional(),
});

const EventSpec = CommandSpec.extend({
  on: z.string().min(1),
});

export const PluginManifestSchema = z.strictObject({
  actions: z.array(ActionSpec).optional(),
  build: z.array(CommandSpec).optional(),
  description: z.string().optional(),
  events: z.array(EventSpec).optional(),
  id: z.string().min(1),
  min_herdr_version: z.string().min(1).optional(),
  name: z.string().min(1),
  panes: z.array(PaneSpec).optional(),
  platforms: z.array(z.enum(["macos", "linux", "windows"])).min(1),
  version: z.string().min(1),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export type ManifestLoadResult =
  | { ok: true; manifest: PluginManifest; path: string }
  | { ok: false; error: string; path: string };

export async function loadManifest(
  path = MANIFEST_PATH
): Promise<ManifestLoadResult> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return { error: "manifest not found", ok: false, path };
  }
  let text: string;
  try {
    text = await file.text();
  } catch (err) {
    return { error: `cannot read manifest: ${String(err)}`, ok: false, path };
  }
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (err) {
    return {
      error: `manifest is not valid TOML: ${err instanceof Error ? err.message : String(err)}`,
      ok: false,
      path,
    };
  }
  const result = PluginManifestSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { error: `manifest invalid: ${issues}`, ok: false, path };
  }
  const manifest = result.data;
  const duplicateIds = firstDuplicate([
    ...(manifest.actions ?? []).map((a) => `action ${a.id}`),
    ...(manifest.panes ?? []).map((p) => `pane ${p.id}`),
  ]);
  if (duplicateIds) {
    return {
      error: `manifest invalid: duplicate ${duplicateIds}`,
      ok: false,
      path,
    };
  }
  return { manifest, ok: true, path };
}

function firstDuplicate(labels: string[]): string | null {
  const seen = new Set<string>();
  for (const label of labels) {
    if (seen.has(label)) {
      return label;
    }
    seen.add(label);
  }
  return null;
}
