// CodeMirror 6 editor for the course language (and the untyped λ-calculus).

import { onCleanup, onMount, createEffect } from 'solid-js';
import { EditorState, Compartment, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, hoverTooltip, type Tooltip } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting, HighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { setDiagnostics, lintGutter, type Diagnostic } from '@codemirror/lint';
import { tags as t } from '@lezer/highlight';
import { ABBREVIATIONS } from './abbrev.ts';
import { LEAN_KEYWORDS } from '../app/highlight.ts';

// same keyword set as the static code blocks, so the two always agree
const KEYWORDS = new RegExp(`^(${[...LEAN_KEYWORDS].sort((a, b) => b.length - a.length).join('|')})(?![\\p{L}\\p{N}_'!?])`, 'u');

const leanLang = StreamLanguage.define<{ comment: number }>({
  startState: () => ({ comment: 0 }),
  token(stream, state) {
    if (state.comment > 0) {
      while (!stream.eol()) {
        if (stream.match('/-')) state.comment++;
        else if (stream.match('-/')) {
          state.comment--;
          if (state.comment === 0) break;
        } else stream.next();
      }
      return 'comment';
    }
    if (stream.eatSpace()) return null;
    if (stream.match('--')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match('/-')) {
      state.comment = 1;
      return 'comment';
    }
    if (stream.match(/^#[a-z]+/)) return 'processingInstruction';
    if (stream.match(KEYWORDS)) return 'keyword';
    if (stream.match(/^(Prop|Type|Sort)\b/) || stream.match('□') || stream.match(/^\*(?![\w])/)) return 'typeName';
    if (stream.match(/^[λΠΣ∀∃]/)) return 'operatorKeyword';
    if (stream.match(/^\d+/)) return 'number';
    if (stream.match(/^"[^"]*"/)) return 'string';
    if (stream.match(/^\?[\p{L}_][\p{L}\p{N}_']*/u)) return 'invalid';
    if (stream.match(/^[A-Z][\p{L}\p{N}_'!?₀-₉.]*/u)) return 'className';
    if (stream.match(/^[\p{L}_][\p{L}\p{N}_'!?₀-₉.]*/u)) return 'variableName';
    if (stream.match(/^(:=|=>|→|->|↦|λ|Π|∀|∃)/)) return 'operatorKeyword';
    stream.next();
    return 'operator';
  },
});

const lambdaLang = StreamLanguage.define<null>({
  startState: () => null,
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match('--')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/^[λ\\]/)) return 'keyword';
    if (stream.match(/^[A-Z][A-Z0-9_']*/)) return 'className';
    if (stream.match(/^\d+/)) return 'number';
    if (stream.match(/^[\p{L}_][\p{L}\p{N}_'₀-₉]*/u)) return 'variableName';
    stream.next();
    return 'operator';
  },
});

const highlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--c-key)' },
  { tag: t.processingInstruction, color: 'var(--c-sort)', fontWeight: '600' },
  { tag: t.typeName, color: 'var(--c-sort)', fontWeight: '600' },
  { tag: t.className, color: 'var(--c-type)' },
  { tag: t.variableName, color: 'var(--ink)' },
  { tag: t.number, color: 'var(--c-num)' },
  { tag: t.string, color: 'var(--c-str)' },
  { tag: t.comment, color: 'var(--c-com)', fontStyle: 'italic' },
  { tag: t.operatorKeyword, color: 'var(--c-key)' },
  { tag: t.operator, color: 'var(--c-op)' },
  { tag: t.invalid, color: 'var(--c-mvar)', fontWeight: '600' },
]);

const theme = EditorView.theme({
  '&': { fontSize: '0.82rem', backgroundColor: 'var(--code-bg)', color: 'var(--fg)' },
  '.cm-content': { fontFamily: 'var(--font-mono)', padding: '0.6rem 0', caretColor: 'var(--accent)', fontVariantLigatures: 'none' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--mute)', border: 'none', borderRight: '1px solid var(--code-border)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--ac) 6%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'var(--accent-soft) !important' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-tooltip': { border: '1px solid var(--rule-strong)', backgroundColor: 'var(--code-bg)', color: 'var(--fg)', borderRadius: '3px', boxShadow: 'var(--shadow-lg)' },
  '.cm-tooltip-hover': { padding: '0.45rem 0.65rem', fontFamily: 'var(--font-ui)', fontSize: '0.76rem', maxWidth: '36rem' },
  '.cm-diagnostic': { fontFamily: 'var(--font-ui)', whiteSpace: 'pre-wrap' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--err)', textUnderlineOffset: '3px' },
  '.cm-lintRange-warning': { backgroundImage: 'none', textDecoration: 'underline wavy var(--warn)', textUnderlineOffset: '3px' },
  '.cm-lintRange-info': { backgroundImage: 'none', textDecoration: 'underline dotted var(--accent)', textUnderlineOffset: '3px' },
  '.cm-matchingBracket': { backgroundColor: 'var(--accent-soft)', outline: 'none' },
});

/** replace `\abbrev` before the cursor when a delimiter is typed */
const abbrevHandler = EditorView.inputHandler.of((view, from, to, text) => {
  if (!/^[\s(){}[\],.:;⟨⟩]$/.test(text)) return false;
  const line = view.state.doc.lineAt(from);
  const before = line.text.slice(0, from - line.from);
  const m = /\\([^\s\\]+)$/.exec(before);
  if (!m) return false;
  const rep = ABBREVIATIONS[m[1]];
  if (!rep) return false;
  const start = from - m[0].length;
  view.dispatch({
    changes: { from: start, to, insert: rep + (text === ' ' ? '' : text) },
    selection: { anchor: start + rep.length + (text === ' ' ? 0 : text.length) },
  });
  return true;
});

export interface EditorProps {
  value: string;
  onChange?: (v: string) => void;
  lang?: 'lean' | 'lambda';
  diagnostics?: Diagnostic[];
  hover?: (pos: number) => { from: number; to: number; dom: HTMLElement } | undefined;
  minHeight?: string;
  maxHeight?: string;
  readOnly?: boolean;
  lineNumbers?: boolean;
  onCursor?: (pos: number) => void;
  ref?: (view: EditorView) => void;
}

export function Editor(props: EditorProps) {
  let host!: HTMLDivElement;
  let view: EditorView | undefined;
  const readOnly = new Compartment();

  onMount(() => {
    const exts: Extension[] = [
      history(),
      drawSelection(),
      highlightActiveLine(),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
      props.lang === 'lambda' ? lambdaLang : leanLang,
      syntaxHighlighting(highlightStyle),
      theme,
      abbrevHandler,
      lintGutter(),
      readOnly.of(EditorState.readOnly.of(!!props.readOnly)),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) props.onChange?.(u.state.doc.toString());
        if (u.selectionSet || u.docChanged) props.onCursor?.(u.state.selection.main.head);
      }),
      EditorView.theme({
        '.cm-scroller': { minHeight: props.minHeight ?? '8rem', maxHeight: props.maxHeight ?? '32rem', overflow: 'auto' },
      }),
    ];
    if (props.lineNumbers !== false) exts.push(lineNumbers());
    if (props.hover) {
      exts.push(
        hoverTooltip((_view, pos): Tooltip | null => {
          const r = props.hover!(pos);
          if (!r) return null;
          return { pos: r.from, end: r.to, above: true, create: () => ({ dom: r.dom }) };
        }),
      );
    }
    view = new EditorView({ state: EditorState.create({ doc: props.value, extensions: exts }), parent: host });
    props.ref?.(view);
  });

  createEffect(() => {
    const v = props.value;
    if (view && v !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
    }
  });

  createEffect(() => {
    const d = props.diagnostics ?? [];
    if (view) {
      const len = view.state.doc.length;
      view.dispatch(setDiagnostics(view.state, d.filter((x) => x.from <= len).map((x) => ({ ...x, to: Math.min(x.to, len) }))));
    }
  });

  onCleanup(() => view?.destroy());
  return <div ref={host} class="editor" />;
}
