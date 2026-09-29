// CodeMirror 6 editor for Kiln source, with syntax highlighting, error
// diagnostics and source-line cross-highlighting (lines carry data-k="src:N").

import { useEffect, useRef } from 'react';
import { EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting, HighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language';
import { setDiagnostics, lintGutter } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import { setHighlight, srcSpanStore } from './store';

const kiln = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match(/^(fn|let|if|else|while|for|in|return|break|continue|global)\b/)) return 'keyword';
    if (stream.match(/^(print|putchar)\b/)) return 'builtin';
    if (stream.match(/^0x[0-9a-fA-F_]+|^[0-9_]+/)) return 'number';
    if (stream.match(/^'(\\.|[^'])'/)) return 'string';
    if (stream.match(/^[A-Za-z_]\w*(?=\s*\()/)) return 'function';
    if (stream.match(/^[A-Za-z_]\w*/)) return 'variable';
    if (stream.match(/^(==|!=|<=|>=|&&|\|\||<<|>>|\.\.|[-+*/%&|^<>=!~])/)) return 'operator';
    stream.next();
    return 'punctuation';
  },
  tokenTable: { builtin: tags.standard(tags.variableName), function: tags.function(tags.variableName) },
});

const hl = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--t-kw)', fontWeight: '600' },
  { tag: tags.comment, color: 'var(--t-comment)', fontStyle: 'italic' },
  { tag: tags.number, color: 'var(--t-imm)' },
  { tag: tags.string, color: 'var(--t-imm)' },
  { tag: tags.operator, color: 'var(--t-op)' },
  { tag: tags.function(tags.variableName), color: 'var(--t-sym)' },
  { tag: tags.standard(tags.variableName), color: 'var(--t-label)' },
  { tag: tags.variableName, color: 'var(--ink)' },
  { tag: tags.punctuation, color: 'var(--t-punct)' },
]);

/** Tag every line with data-k="src:N" so other views can light it up. */
const lineKeys = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(v: EditorView) { this.decorations = this.build(v); }
  update(u: ViewUpdate) { if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view); }
  build(v: EditorView) {
    const b = new RangeSetBuilder<Decoration>();
    for (const { from, to } of v.visibleRanges) {
      for (let pos = from; pos <= to; ) {
        const line = v.state.doc.lineAt(pos);
        b.add(line.from, line.from, Decoration.line({ attributes: { 'data-k': `src:${line.number}`, 'data-l': `src:${line.number}` } }));
        pos = line.to + 1;
      }
    }
    return b.finish();
  }
}, { decorations: (v) => v.decorations });

/** The source span of whatever is hovered elsewhere (an AST node), marked in the text. */
const setSpan = StateEffect.define<{ from: number; to: number } | null>();
const spanMark = Decoration.mark({ class: 'cm-srcSpan' });
const spanField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(d, tr) {
    d = d.map(tr.changes);
    for (const e of tr.effects) if (e.is(setSpan)) d = e.value && e.value.to > e.value.from ? Decoration.set([spanMark.range(e.value.from, e.value.to)]) : Decoration.none;
    return d;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const setError = StateEffect.define<{ line: number; col: number; msg: string } | null>();
const errorField = StateField.define<null>({ create: () => null, update: (v) => v });

export interface EditorProps {
  value: string;
  onChange: (v: string) => void;
  error?: { line?: number; col?: number; msg: string } | null;
  minHeight?: number;
}

export function Editor({ value, onChange, error, minHeight = 200 }: EditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), history(), bracketMatching(), indentOnInput(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          kiln, syntaxHighlighting(hl), lineKeys, lintGutter(), errorField, spanField,
          EditorState.tabSize.of(2),
          EditorView.updateListener.of((u) => { if (u.docChanged) cb.current(u.state.doc.toString()); }),
          EditorView.domEventHandlers({
            mousemove(e, view) {
              const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
              if (pos === null) return;
              const n = view.state.doc.lineAt(pos).number;
              setHighlight({ own: [`src:${n}`], linkedTo: [`src:${n}`] });
            },
            mouseleave() { setHighlight(null); },
          }),
        ],
      }),
    });
    view.current = v;
    const unsub = srcSpanStore.subscribe(() => {
      const sp = srcSpanStore.get();
      if (!sp) { v.dispatch({ effects: setSpan.of(null) }); return; }
      const doc = v.state.doc;
      const off = (p: { line: number; col: number }) => {
        const l = doc.line(Math.max(1, Math.min(p.line, doc.lines)));
        return Math.min(l.from + Math.max(0, p.col - 1), l.to);
      };
      const from = off(sp.from), to = off(sp.to);
      v.dispatch({ effects: [setSpan.of({ from, to }), EditorView.scrollIntoView(from, { y: 'nearest' })] });
    });
    return () => { unsub(); v.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    if (!error || !error.line) { v.dispatch(setDiagnostics(v.state, [])); return; }
    const ln = Math.min(error.line, v.state.doc.lines);
    const line = v.state.doc.line(ln);
    const from = Math.min(line.from + Math.max(0, (error.col ?? 1) - 1), line.to);
    v.dispatch(setDiagnostics(v.state, [{ from, to: Math.max(from + 1, Math.min(line.to, from + 12)), severity: 'error', message: error.msg }]));
    void setError;
  }, [error]);

  return <div className="editor inv" ref={host} style={{ minHeight }} />;
}
