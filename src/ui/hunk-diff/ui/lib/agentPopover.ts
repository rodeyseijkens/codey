import { sanitizeTerminalLine } from "../../lib/terminalText";
import { measureTextWidth, sliceTextByWidth } from "./text";

export function wrapText(text: string, width: number) {
  if (width <= 0) {
    return [""];
  }

  const normalized = sanitizeTerminalLine(text).trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return [""];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  let currentWidth = 0;

  const pushCurrent = () => {
    if (current.length > 0) {
      lines.push(current);
      current = "";
      currentWidth = 0;
    }
  };

  for (const word of words) {
    const wordWidth = measureTextWidth(word);

    if (wordWidth > width) {
      pushCurrent();
      let offset = 0;
      while (offset < wordWidth) {
        const chunk = sliceTextByWidth(word, offset, width);
        if (chunk.width <= 0) {
          const rest = sliceTextByWidth(word, offset, Number.MAX_SAFE_INTEGER);
          if (rest.text.length > 0) {
            lines.push(rest.text);
          }
          break;
        }
        lines.push(chunk.text);
        offset += chunk.width;
      }
      continue;
    }

    const nextWidth = current.length === 0 ? wordWidth : currentWidth + 1 + wordWidth;
    if (nextWidth <= width) {
      current = current.length === 0 ? word : `${current} ${word}`;
      currentWidth = nextWidth;
      continue;
    }

    pushCurrent();
    current = word;
    currentWidth = wordWidth;
  }

  pushCurrent();
  return lines.length > 0 ? lines : [""];
}
