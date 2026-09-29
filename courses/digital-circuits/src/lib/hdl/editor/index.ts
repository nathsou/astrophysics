/**
 * The DCL editor: CodeMirror 6 with the compiler's front end behind it.
 *
 * - **Highlighting** from the compiler's lexer (`tokens.ts`), coloured with the design tokens (`theme.ts`).
 * - **Diagnostics** from `check`, run in a Web Worker (`client.ts`) after a pause in typing, shown as
 *   underlines, in the gutter and in tooltips.
 * - **Hover**: the type and doc comment of the name under the pointer, and what an expression costs in
 *   hardware ("4-bit adder: 3 XOR gates, …").
 * - **Completions**: keywords, names in scope, the ports of `inst x: Module(`, members after a dot.
 * - **Format** with Shift-Alt-F (`formatDocument`), **go to definition** with F12, indentation by nesting,
 *   bracket matching and closing, search, undo.
 * - **Cross-probing** hooks for the widgets: `setProbe` marks source ranges (the source of the gates under
 *   the pointer in the schematic), and `onPointer` reports the offset under the pointer.
 *
 * ```ts
 * const editor = createDclEditor(parent, { doc, onChange: (text) => …, analyze: (text) => analyzer.run({ source: text }) });
 * ```
 */
import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { lintGutter, lintKeymap, linter } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { Annotation, Compartment, EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, type DecorationSet } from '@codemirror/view';
import type { Analysis } from './analysis';
import { dclCompletion } from './complete';
import { formatDocument, type FormatOutcome } from './format';
import { dclHover } from './hover';
import { dclLanguage } from './language';
import { toCmDiagnostics } from './lint';
import { definitionAt } from './queries';
import { dclTheme } from './theme';
import { dclTokens } from './tokens';

export type { Analysis } from './analysis';
export { formatDocument, type FormatOutcome } from './format';
export { highlightDclHtml } from './highlightHtml';

export interface Range {
  from: number;
  to: number;
}

export interface DclEditorOptions {
  doc?: string;
  onChange?: (doc: string) => void;
  readOnly?: boolean;
  /**
   * Analyses the text (after `delay` ms without typing). Its result gives the diagnostics, hover and
   * completions; resolve to undefined to skip (a newer request superseded this one).
   */
  analyze?: (source: string) => Promise<Analysis | undefined>;
  /** Called with every analysis the editor obtained. */
  onAnalysis?: (a: Analysis) => void;
  /** The offset (and 1-based line) under the pointer, or null when it leaves the text. */
  onPointer?: (hit: { offset: number; line: number; gutter?: boolean } | null) => void;
  onFormat?: (outcome: FormatOutcome) => void;
  ariaLabel?: string;
  lineNumbers?: boolean;
  /** Milliseconds of quiet before analysing (default 300). */
  delay?: number;
}

export interface DclEditor {
  readonly view: EditorView;
  getDoc(): string;
  /** Replaces the document (without calling `onChange`). */
  setDoc(text: string): void;
  focus(): void;
  destroy(): void;
  /** Marks source ranges (cross-probing). An empty list clears them. */
  setProbe(ranges: Range[]): void;
  setReadOnly(readOnly: boolean): void;
  format(): FormatOutcome;
  /** The latest analysis. */
  analysis(): Analysis | undefined;
  /** Scrolls a source offset into view and moves the cursor there. */
  reveal(offset: number): void;
}

/** Marks a transaction as a replacement from outside (`setDoc`), which must not call `onChange`. */
const external = Annotation.define<boolean>();
const setProbeEffect = StateEffect.define<Range[]>();
const probeMark = Decoration.mark({ class: 'cm-dcl-probe' });
const probeField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let v = value.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setProbeEffect)) {
        const len = tr.state.doc.length;
        v = Decoration.set(
          e.value
            .filter((r) => r.to > r.from && r.from >= 0 && r.to <= len)
            .sort((a, b) => a.from - b.from)
            .map((r) => probeMark.range(r.from, r.to)),
          true,
        );
      }
    }
    return v;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function createDclEditor(parent: HTMLElement, options: DclEditorOptions = {}): DclEditor {
  let latest: Analysis | undefined;
  const readOnly = new Compartment();
  let view: EditorView;

  const analysisOf = options.analyze;
  const source = analysisOf
    ? linter(
        async (v) => {
          const text = v.state.doc.toString();
          const a = await analysisOf(text);
          if (!a) return [];
          latest = a;
          options.onAnalysis?.(a);
          // The document may have changed while the worker was busy; those results are already out of date.
          return v.state.doc.toString() === text ? toCmDiagnostics(a, v.state.doc.length) : [];
        },
        { delay: options.delay ?? 300 },
      )
    : [];

  const extensions: Extension[] = [
    options.lineNumbers === false ? [] : lineNumbers({ domEventHandlers: {
      mouseover(v, line) {
        options.onPointer?.({ offset: line.from, line: v.state.doc.lineAt(line.from).number, gutter: true });
        return false;
      },
      mouseout() {
        options.onPointer?.(null);
        return false;
      },
    } }),
    highlightActiveLineGutter(),
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    dclLanguage,
    dclTokens,
    probeField,
    dclTheme,
    source,
    lintGutter(),
    dclHover(() => latest),
    dclCompletion(() => latest),
    keymap.of([
      { key: 'Shift-Alt-f', preventDefault: true, run: (v) => { options.onFormat?.(formatDocument(v)); return true; } },
      { key: 'F12', run: (v) => {
        const a = latest;
        if (!a) return false;
        const d = definitionAt(a, v.state.selection.main.head);
        if (!d) return false;
        v.dispatch({ selection: { anchor: d.from, head: d.to }, scrollIntoView: true });
        return true;
      } },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...completionKeymap,
      ...lintKeymap,
    ]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged && !u.transactions.every((t) => t.annotation(external))) options.onChange?.(u.state.doc.toString());
    }),
    EditorView.domEventHandlers({
      mousemove(ev, v) {
        if (!options.onPointer) return false;
        const pos = v.posAtCoords({ x: ev.clientX, y: ev.clientY }, false);
        if (pos === null) return false;
        options.onPointer({ offset: pos, line: v.state.doc.lineAt(pos).number });
        return false;
      },
      mouseleave() {
        options.onPointer?.(null);
        return false;
      },
    }),
    EditorView.contentAttributes.of({ 'aria-label': options.ariaLabel ?? 'DCL source code', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
    readOnly.of([EditorState.readOnly.of(!!options.readOnly), EditorView.editable.of(!options.readOnly)]),
  ];

  view = new EditorView({ parent, state: EditorState.create({ doc: options.doc ?? '', extensions }) });

  return {
    view,
    getDoc: () => view.state.doc.toString(),
    setDoc(text) {
      if (text === view.state.doc.toString()) return;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, annotations: external.of(true) });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
    setProbe: (ranges) => view.dispatch({ effects: setProbeEffect.of(ranges) }),
    setReadOnly: (ro) => view.dispatch({ effects: readOnly.reconfigure([EditorState.readOnly.of(ro), EditorView.editable.of(!ro)]) }),
    format: () => {
      const r = formatDocument(view);
      options.onFormat?.(r);
      return r;
    },
    analysis: () => latest,
    reveal(offset) {
      const at = Math.max(0, Math.min(offset, view.state.doc.length));
      view.dispatch({ selection: { anchor: at }, effects: EditorView.scrollIntoView(at, { y: 'center' }) });
    },
  };
}
