// biome-ignore lint/style/useFilenamingConvention: PascalCase for component file
import { useRef } from "react";
import { createTextAttributes, type TextareaRenderable } from "@opentui/core";

import type { AppTheme } from "../../theme/resolve";
import { useDraftClear } from "../../use-draft-clear";
import { sanitizeTerminalLine } from "../render/terminalText";
import { fitText } from "../render/text";
import type { AgentAnnotation, DiffFile, LayoutMode } from "../render/types";
import { resolveStmlColor } from "../stml/colors";
import { layoutStmlCached, type StmlLine } from "../stml/layout";
import { annotationRangeLabel, reviewNoteSource } from "./agentAnnotations";
import { agentNoteBoxLayout } from "./agentNoteGeometry";
import { wrapText } from "./agentPopover";

const TRASH_ICON = "\uf48e";

export function inlineNoteTitle(
  annotation: AgentAnnotation,
  noteIndex: number,
  noteCount: number,
) {
  if (annotation.source === "user-draft") {
    return "\uf448 ";
  }
  const source = reviewNoteSource(annotation);
  const author = sanitizeTerminalLine(annotation.author?.trim() ?? "");
  let label: string;
  if (source === "user") {
    label = "\uf4f6 ";
  } else if (author) {
    label = `${author} note`;
  } else {
    label = "Agent note";
  }
  return noteCount > 1 ? `${label} ${noteIndex + 1}/${noteCount}` : label;
}

function wrapNoteText(text: string, width: number) {
  return text
    .split("\n")
    .flatMap((line) => wrapText(sanitizeTerminalLine(line), width));
}

function markupLines(
  annotation: AgentAnnotation,
  contentWidth: number,
): StmlLine[] | null {
  if (!annotation.markup || annotation.source === "user-draft") {
    return null;
  }
  const { lines } = layoutStmlCached(annotation.markup, contentWidth);
  return lines.length > 0 ? lines : null;
}

export function measureCommentCardHeight({
  annotation,
  anchorSide,
  layout,
  width,
}: {
  annotation: AgentAnnotation;
  anchorSide?: "old" | "new";
  layout: Exclude<LayoutMode, "auto">;
  width: number;
}) {
  const { contentWidth } = agentNoteBoxLayout({ anchorSide, layout, width });
  const lines = markupLines(annotation, contentWidth);
  const bodyLineCount = lines
    ? lines.length
    : wrapNoteText(annotation.summary, contentWidth).length +
      (annotation.rationale
        ? wrapNoteText(annotation.rationale, contentWidth).length
        : 0);
  return 2 + bodyLineCount;
}

function renderNoteBody(lines: (string | StmlLine)[], theme: AppTheme) {
  return lines.map((line, index) => (
    <box
      // biome-ignore lint/suspicious/noArrayIndexKey: static display list, no reordering
      key={`body:${index}`}
      style={{
        backgroundColor: theme.noteBackground,
        height: 1,
        width: "100%",
      }}
    >
      {typeof line === "string" ? (
        <text bg={theme.noteBackground} fg={theme.text}>
          {line}
        </text>
      ) : (
        <text>
          {line.spans.map((span, spanIndex) => (
            <span
              attributes={createTextAttributes({
                bold: span.bold,
                dim: span.dim,
                italic: span.italic,
                strikethrough: span.strike,
                underline: span.underline,
              })}
              bg={resolveStmlColor(span.bg, theme) ?? theme.noteBackground}
              fg={resolveStmlColor(span.fg, theme) ?? theme.text}
              // biome-ignore lint/suspicious/noArrayIndexKey: static display list, no reordering
              key={`span:${spanIndex}`}
            >
              {span.text}
            </span>
          ))}
        </text>
      )}
    </box>
  ));
}

export function CommentCard({
  annotation,
  anchorSide,
  file,
  layout,
  noteCount = 1,
  noteIndex = 0,
  draft,
  onDelete,
  theme,
  width,
}: {
  annotation: AgentAnnotation;
  anchorSide?: "old" | "new";
  file?: DiffFile;
  layout: Exclude<LayoutMode, "auto">;
  noteCount?: number;
  noteIndex?: number;
  draft?: {
    body: string;
    focused: boolean;
    onCancel: () => void;
    onInput: (value: string) => void;
    onSave: () => void;
  };
  onDelete?: () => void;
  theme: AppTheme;
  width: number;
}) {
  const textareaRef = useRef<TextareaRenderable | null>(null);
  const titleText = `${inlineNoteTitle(annotation, noteIndex, noteCount)} — ${annotationRangeLabel(annotation, file)}`;
  useDraftClear(textareaRef);
  const { boxWidth, contentWidth } = agentNoteBoxLayout({
    anchorSide,
    layout,
    width,
  });
  const draftContentWidth = Math.max(1, boxWidth - 4);

  const closeText = !draft && onDelete ? TRASH_ICON : "";
  const titleFitWidth = Math.max(
    0,
    boxWidth - 4 - (closeText ? closeText.length + 1 : 0),
  );
  const titleLabel = fitText(` ${titleText} `, titleFitWidth);

  const body =
    draft === undefined
      ? (markupLines(annotation, contentWidth) ?? [
          ...wrapNoteText(annotation.summary, contentWidth),
          ...(annotation.rationale
            ? wrapNoteText(annotation.rationale, contentWidth)
            : []),
        ])
      : null;

  return (
    <box
      style={{
        backgroundColor: theme.noteTitleBackground,
        flexDirection: "column",
        padding: 1,
        width: "100%",
      }}
    >
      <box
        style={{
          backgroundColor: theme.noteTitleBackground,
          flexDirection: "row",
          width: "100%",
        }}
      >
        <text fg={theme.noteBorder}>{titleLabel}</text>
        <box style={{ flexGrow: 1 }} />
        {onDelete ? (
          <box
            onMouseUp={onDelete}
            style={{ height: 1, marginRight: 1, width: closeText.length }}
          >
            <text bg={theme.noteTitleBackground} fg="red">
              {closeText}
            </text>
          </box>
        ) : null}
      </box>
      <box
        style={{
          backgroundColor: theme.noteTitleBackground,
          flexDirection: "column",
          paddingLeft: 1,
          paddingRight: 1,
          width: "100%",
        }}
      >
        {draft === undefined ? (
          renderNoteBody(body ?? [""], theme)
        ) : (
          <textarea
            backgroundColor={theme.noteBackground}
            focused={draft.focused}
            focusedBackgroundColor={theme.noteBackground}
            focusedTextColor={theme.text}
            height={1}
            initialValue={draft.body}
            keyBindings={[
              { action: "submit", name: "return" },
              { action: "newline", name: "return", shift: true },
            ]}
            onContentChange={() => {
              draft.onInput(textareaRef.current?.plainText ?? "");
            }}
            onSubmit={draft.onSave}
            placeholder="type comment, Enter to save, Shift+Enter for newline"
            ref={textareaRef}
            textColor={theme.text}
            width={draftContentWidth}
            wrapMode="word"
          />
        )}
      </box>
    </box>
  );
}
