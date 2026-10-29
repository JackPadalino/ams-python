import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Compartment, EditorSelection, EditorState, Prec, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
  insertNewline,
  insertNewlineAndIndent,
} from "@codemirror/commands";
import { HighlightStyle, bracketMatching, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { tags as t } from "@lezer/highlight";

// Deliberately NOT included: autocompletion, closeBrackets, and anything else
// that writes code for the student.

const setErrorLine = StateEffect.define();
const errorLineDecoration = Decoration.line({ class: "cm-error-line" });

const errorLineField = StateField.define({
  create: () => Decoration.none,
  update(decorations, tr) {
    if (tr.docChanged) decorations = Decoration.none;
    for (const effect of tr.effects) {
      if (!effect.is(setErrorLine)) continue;
      const line = effect.value;
      decorations = line && line <= tr.state.doc.lines
        ? Decoration.set([errorLineDecoration.range(tr.state.doc.line(line).from)])
        : Decoration.none;
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

// Tab inserts spaces up to the next multiple of 4 (or indents every selected
// line). This works the same whether auto-indent is on or off.
function insertTab(view) {
  const { state } = view;
  if (state.selection.ranges.some((r) => !r.empty)) return indentMore(view);
  view.dispatch(
    state.changeByRange((range) => {
      const line = state.doc.lineAt(range.head);
      const spaces = 4 - ((range.head - line.from) % 4);
      return {
        changes: { from: range.head, insert: " ".repeat(spaces) },
        range: EditorSelection.cursor(range.head + spaces),
      };
    }),
  );
  return true;
}

function autoIndentExtension(on) {
  return on
    ? [indentOnInput(), Prec.high(keymap.of([{ key: "Enter", run: insertNewlineAndIndent }]))]
    : Prec.high(keymap.of([{ key: "Enter", run: insertNewline }]));
}

// Blocks every way of bringing outside text in: paste (keyboard, menu,
// right-click, middle-click) and drag-and-drop.
function pasteBlocker(onBlocked) {
  return [
    EditorState.transactionFilter.of((tr) => {
      if (tr.isUserEvent("input.paste") || tr.isUserEvent("input.drop")) {
        onBlocked();
        return [];
      }
      return tr;
    }),
    EditorView.domEventHandlers({
      paste(event) {
        event.preventDefault();
        onBlocked();
        return true;
      },
      drop(event) {
        event.preventDefault();
        onBlocked();
        return true;
      },
      beforeinput(event) {
        if (/^insertFrom(Paste|Drop|Yank)/.test(event.inputType)) {
          event.preventDefault();
          onBlocked();
          return true;
        }
        return false;
      },
    }),
  ];
}

// Colors come from CSS variables so each theme (light, dark, retro) can set
// its own palette in index.css.
const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword, t.self], color: "var(--syn-keyword)" },
  { tag: [t.string, t.special(t.string)], color: "var(--syn-string)" },
  { tag: [t.number, t.bool, t.null], color: "var(--syn-number)" },
  { tag: t.comment, color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--syn-function)" },
  { tag: [t.definition(t.variableName), t.function(t.definition(t.variableName)), t.className], color: "var(--syn-definition)" },
  { tag: t.invalid, color: "var(--stderr)" },
]);

const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "15px", backgroundColor: "var(--editor-bg)" },
  ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "1.55" },
  ".cm-content": { padding: "10px 0", caretColor: "var(--text)" },
  ".cm-gutters": {
    backgroundColor: "var(--editor-gutter)",
    color: "var(--text-faint)",
    border: "none",
    borderRight: "1px solid var(--border)",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 14px" },
  ".cm-activeLine": { backgroundColor: "var(--editor-active)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--editor-active)", color: "var(--text-muted)" },
  ".cm-error-line": { backgroundColor: "var(--error-line)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--text)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--selection)",
  },
  "&.cm-focused .cm-matchingBracket": { backgroundColor: "var(--matching-bracket)", outline: "none" },
  "&.cm-focused": { outline: "none" },
});

/**
 * Python code editor.
 *
 * docKey: change it to load a new file (resets undo history).
 * Ref methods: getValue(), goToLine(n).
 */
const CodeEditor = forwardRef(function CodeEditor(
  { docKey, initialValue, onChange, autoIndent, blockPaste, onPasteBlocked, errorLine, onRun, onSave },
  ref,
) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const compartments = useRef({ indent: new Compartment(), paste: new Compartment() });
  // Keep the latest callbacks without rebuilding the editor.
  const callbacks = useRef({});
  callbacks.current = { onChange, onPasteBlocked, onRun, onSave };

  const buildState = (doc) =>
    EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        bracketMatching(),
        python(),
        syntaxHighlighting(highlightStyle),
        indentUnit.of("    "),
        EditorState.tabSize.of(4),
        compartments.current.indent.of(autoIndentExtension(autoIndent)),
        compartments.current.paste.of(blockPaste ? pasteBlocker(() => callbacks.current.onPasteBlocked?.()) : []),
        Prec.highest(
          keymap.of([
            { key: "Mod-Enter", run: () => (callbacks.current.onRun?.(), true) },
            { key: "Mod-s", run: () => (callbacks.current.onSave?.(), true), preventDefault: true },
            { key: "Tab", run: insertTab, shift: indentLess },
          ]),
        ),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        errorLineField,
        editorTheme,
        EditorView.contentAttributes.of({ spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) callbacks.current.onChange?.(update.state.doc.toString());
        }),
      ],
    });

  useEffect(() => {
    const view = new EditorView({ state: buildState(initialValue ?? ""), parent: hostRef.current });
    viewRef.current = view;
    return () => view.destroy();
    // The editor is created once; later changes go through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.setState(buildState(initialValue ?? ""));
    // Only reload when a different file is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.current.indent.reconfigure(autoIndentExtension(autoIndent)),
    });
  }, [autoIndent, docKey]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setErrorLine.of(errorLine || null) });
  }, [errorLine]);

  useImperativeHandle(ref, () => ({
    getValue: () => viewRef.current?.state.doc.toString() ?? "",
    goToLine(n) {
      const view = viewRef.current;
      if (!view || !n || n > view.state.doc.lines) return;
      const line = view.state.doc.line(n);
      view.dispatch({ selection: { anchor: line.to }, scrollIntoView: true });
      view.focus();
    },
    focus: () => viewRef.current?.focus(),
  }));

  return <div className="code-editor" ref={hostRef} />;
});

export default CodeEditor;
