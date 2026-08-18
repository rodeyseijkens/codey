import {
  createTextAttributes,
  EditBuffer,
  EditorView,
  type TextareaRenderable,
} from "@opentui/core";
import { useLayoutEffect, useRef } from "react";
import { useDraftClear } from "../../../../use-draft-clear";
import type { AgentAnnotation, DiffFile, LayoutMode } from "../../../core/types";
import { sanitizeTerminalLine } from "../../../lib/terminalText";
import { annotationRangeLabel, reviewNoteSource } from "../../lib/agentAnnotations";
import { agentNoteBoxLayout } from "../../lib/agentNoteGeometry";
import { wrapText } from "../../lib/agentPopover";
import { resolveStmlColor } from "../../lib/stml/colors";
import { layoutStmlCached, type StmlLine, type StmlSpan } from "../../lib/stml/layout";
import { fitText } from "../../lib/text";
import type { AppTheme } from "../../themes";

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
  const label = source === "user" ? "\uf4f6 " : author ? `${author} note` : "Agent note";
  return noteCount > 1 ? `${label} ${noteIndex + 1}/${noteCount}` : label;
}

function wrapNoteText(text: string, width: number) {
  return text.split("\n").flatMap((line) => wrapText(sanitizeTerminalLine(line), width));
}

function markupLines(annotation: AgentAnnotation, contentWidth: number): StmlLine[] | null {
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
      (annotation.rationale ? wrapNoteText(annotation.rationale, contentWidth).length : 0);
  return 2 + bodyLineCount;
}

function renderNoteBody(lines: (string | StmlLine)[], theme: AppTheme) {
  return lines.map((line, index) => (
    <box
      key={`body:${index}`}
      style={{ width: "100%", height: 1, backgroundColor: theme.noteBackground }}
    >
      {typeof line === "string" ? (
        <text fg={theme.text} bg={theme.noteBackground}>
          {line}
        </text>
      ) : (
        <text>
          {line.spans.map((span, spanIndex) => (
            <span
              key={`span:${spanIndex}`}
              fg={resolveStmlColor(span.fg, theme) ?? theme.text}
              bg={resolveStmlColor(span.bg, theme) ?? theme.noteBackground}
              attributes={createTextAttributes({
                bold: span.bold,
                italic: span.italic,
                underline: span.underline,
                dim: span.dim,
                strikethrough: span.strike,
              })}
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
  const titleFitWidth = Math.max(0, boxWidth - 4 - (closeText ? closeText.length + 1 : 0));
  const titleLabel = fitText(` ${titleText} `, titleFitWidth);

  const body =
    draft === undefined
      ? (markupLines(annotation, contentWidth) ??
        [
          ...wrapNoteText(annotation.summary, contentWidth),
          ...(annotation.rationale
            ? wrapNoteText(annotation.rationale, contentWidth)
            : []),
        ])
      : null;

  return (
    <box style={{ width: "100%", flexDirection: "column", backgroundColor: theme.noteTitleBackground, padding: 1 }}>
      <box style={{ width: "100%", flexDirection: "row", backgroundColor: theme.noteTitleBackground }}>
        <text fg={theme.noteBorder}>{titleLabel}</text>
        <box style={{ flexGrow: 1 }} />
        {onDelete ? (
          <box onMouseUp={onDelete} style={{ width: closeText.length, height: 1, marginRight: 1 }}>
            <text fg="red" bg={theme.noteTitleBackground}>
              {closeText}
            </text>
          </box>
        ) : null}
      </box>
      <box style={{ width: "100%", flexDirection: "column", backgroundColor: theme.noteTitleBackground, paddingLeft: 1, paddingRight: 1 }}>
        {draft !== undefined ? (
          <textarea
            ref={textareaRef}
            width={draftContentWidth}
             height={1}
             initialValue={draft.body}
             placeholder="type comment, Enter to save, Shift+Enter for newline"
             focused={draft.focused}
             wrapMode="word"
             backgroundColor={theme.noteBackground}
             textColor={theme.text}
             focusedBackgroundColor={theme.noteBackground}
             focusedTextColor={theme.text}
             keyBindings={[
               { name: "return", action: "submit" },
               { name: "return", shift: true, action: "newline" },
             ]}
             onSubmit={draft.onSave}
             onContentChange={() => {
               draft.onInput(textareaRef.current?.plainText ?? "");
             }}
           />
        ) : (
          renderNoteBody(body ?? [""], theme)
        )}
      </box>
    </box>
  );
}
