import { parse } from "smol-toml";
import { z } from "zod";

export const CONFIG_DIR = `${process.env.HOME ?? "~"}/.config/codey`;
export const CONFIG_PATH = `${CONFIG_DIR}/config.toml`;

export const ConfigSchema = z.strictObject({
  gutterSign: z.boolean().default(false),
  keybindings: z.record(z.string(), z.string()).default({}),
  lineNumbers: z.boolean().default(true),
  mode: z.enum(["split", "stack", "auto"]).default("auto"),
  sidebarWidth: z.number().int().min(16).max(80).default(32),
  tabWidth: z.number().int().min(1).max(8).default(4),
  theme: z.string().default("auto"),
  view: z.enum(["tree", "list"]).default("tree"),
  watch: z.boolean().default(false),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export type ConfigLoadResult =
  | { ok: true; config: AppConfig; path: string }
  | { ok: false; error: string; path: string };

export async function loadConfig(
  path = CONFIG_PATH
): Promise<ConfigLoadResult> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return { config: ConfigSchema.parse({}), ok: true, path };
  }
  let text: string;
  try {
    text = await file.text();
  } catch (err) {
    return { error: `cannot read config: ${String(err)}`, ok: false, path };
  }
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (err) {
    return {
      error: `config is not valid TOML: ${err instanceof Error ? err.message : String(err)}`,
      ok: false,
      path,
    };
  }
  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { error: `config invalid: ${issues}`, ok: false, path };
  }
  return { config: result.data, ok: true, path };
}
