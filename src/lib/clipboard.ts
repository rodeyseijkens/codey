import { commentKey, type Scope } from "../types";

export type ClipboardResult = {
  error?: string;
  method?: "osc52" | "pbcopy" | "wl-copy" | "xclip" | "xsel";
  ok: boolean;
};

type Osc52Writer = (text: string) => boolean;

async function pipeToTool(
  cmd: string[],
  text: string,
  method: ClipboardResult["method"],
): Promise<ClipboardResult> {
  try {
    const proc = Bun.spawn(cmd, {
      stderr: "pipe",
      stdin: "pipe",
      stdout: "ignore",
    });
    proc.stdin.write(new TextEncoder().encode(text));
    proc.stdin.end();
    const exitCode = await proc.exited;
    if (exitCode === 0) {
      return { method, ok: true };
    }
    const stderr = await new Response(proc.stderr).text();
    return { error: stderr.trim() || `exit ${exitCode}`, ok: false };
  } catch (err) {
    return { error: String(err), ok: false };
  }
}

export async function copyText(
  text: string,
  osc52?: Osc52Writer,
): Promise<ClipboardResult> {
  const { platform } = process;
  if (platform === "darwin") {
    const res = await pipeToTool(["pbcopy"], text, "pbcopy");
    if (res.ok) {
      return res;
    }
  } else if (platform === "linux") {
    if (process.env.WAYLAND_DISPLAY) {
      const wl = await pipeToTool(["wl-copy"], text, "wl-copy");
      if (wl.ok) {
        return wl;
      }
    }
    const xclip = await pipeToTool(
      ["xclip", "-selection", "clipboard"],
      text,
      "xclip",
    );
    if (xclip.ok) {
      return xclip;
    }
    const xsel = await pipeToTool(
      ["xsel", "--clipboard", "--input"],
      text,
      "xsel",
    );
    if (xsel.ok) {
      return xsel;
    }
  }
  if (osc52?.(text)) {
    return { method: "osc52", ok: true };
  }
  return {
    error: "no clipboard tool found (pbcopy/wl-copy/xclip/xsel/OSC52)",
    ok: false,
  };
}

export function formatCommentsAsMarkdown(
  title: string,
  comments: {
    scope: Scope;
    path: string;
    startRow: number;
    endRow: number;
    context: string;
    text: string;
  }[],
): string {
  const lines: string[] = [`# ${title}`, ""];
  const byFile = new Map<string, typeof comments>();
  for (const c of comments) {
    const key = commentKey(c.scope, c.path);
    const arr = byFile.get(key) ?? [];
    arr.push(c);
    byFile.set(key, arr);
  }
  for (const [key, list] of byFile) {
    lines.push(`## ${key}`, "");
    for (const c of list) {
      const range =
        c.startRow === c.endRow
          ? `line ${c.startRow}`
          : `lines ${c.startRow}-${c.endRow}`;
      lines.push(`- **${range}**${c.context ? ` (\`${c.context}\`)` : ""}`);
      lines.push(`  ${c.text}`, "");
    }
  }
  return lines.join("\n");
}
