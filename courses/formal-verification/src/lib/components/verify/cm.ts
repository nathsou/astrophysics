/**
 * CodeMirror 6 extensions for Vouch, on top of @codemirror/lsp-client:
 *   - highlighting from the language server's semantic tokens (with the lexer as an instant fallback);
 *   - inlay hints (inferred types);
 *   - a gutter of verdict seals: ✓ verified, ✗ violated, ◌ tested, ? unknown, at the property or function they belong to;
 *   - locked regions, for exercises that fix a specification and let the reader edit only the rest.
 * Everything is styled with the Notary tokens.
 */
import { EditorState, RangeSet, RangeSetBuilder, StateEffect, StateField, type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, ViewPlugin, WidgetType, gutter, hoverTooltip, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import type { LSPClient } from '@codemirror/lsp-client';
import { classify, TOKEN_TYPES } from '$lib/fv/vouch/lsp/tokens';
import type { RangedVerdict, VerdictsPayload } from './lsp';
import { badgeText } from '$lib/fv/engines';

// ── Semantic highlighting ──
const setTokens = StateEffect.define<DecorationSet>();

const tokenField = StateField.define<DecorationSet>({
  create: (state) => decorationsFromLexer(state.doc.toString()),
  update(deco, tr) {
    for (const e of tr.effects) if (e.is(setTokens)) return e.value;
    if (tr.docChanged) return deco.map(tr.changes);
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const markFor = (type: string, mods: number) => Decoration.mark({ class: `vt vt-${type}${mods & 4 ? ' vt-spec' : ''}${mods & 8 ? ' vt-ghost' : ''}${mods & 1 ? ' vt-decl' : ''}` });

function decorationsFromLexer(text: string): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  for (const t of classify(text, undefined)) if (t.length > 0) b.add(t.start, t.start + t.length, markFor(t.type, t.modifiers));
  // Comments are not tokens of the lexer: mark them here.
  const ranges: Range<Decoration>[] = [];
  for (const m of text.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g)) ranges.push(Decoration.mark({ class: 'vt vt-comment' }).range(m.index!, m.index! + m[0].length));
  return RangeSet.join([b.finish(), Decoration.set(ranges, true)]);
}

function decodeTokens(state: EditorState, data: number[]): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  let line = 0;
  let char = 0;
  for (let i = 0; i + 4 < data.length + 1 && i < data.length; i += 5) {
    const dl = data[i]!;
    const dc = data[i + 1]!;
    line += dl;
    char = dl ? dc : char + dc;
    if (line + 1 > state.doc.lines) break;
    const from = state.doc.line(line + 1).from + char;
    const to = Math.min(from + data[i + 2]!, state.doc.length);
    if (to > from) ranges.push(markFor(TOKEN_TYPES[data[i + 3]!] ?? 'variable', data[i + 4]!).range(from, to));
  }
  const text = state.doc.toString();
  for (const m of text.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g)) ranges.push(Decoration.mark({ class: 'vt vt-comment' }).range(m.index!, m.index! + m[0].length));
  return Decoration.set(ranges, true);
}

// ── Inlay hints ──
const setHints = StateEffect.define<DecorationSet>();
class HintWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(o: HintWidget) {
    return o.text === this.text;
  }
  toDOM() {
    const s = document.createElement('span');
    s.className = 'vt-hint';
    s.textContent = this.text;
    return s;
  }
}
const hintField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) if (e.is(setHints)) return e.value;
    return tr.docChanged ? Decoration.none : deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Ask the server for semantic tokens and inlay hints after each change (debounced), dropping stale answers. */
export function serverHighlighting(client: LSPClient, uri: string): Extension {
  return [
    tokenField,
    hintField,
    ViewPlugin.fromClass(
      class {
        timer: ReturnType<typeof setTimeout> | undefined;
        constructor(readonly view: EditorView) {
          this.schedule(400);
        }
        update(u: ViewUpdate) {
          if (u.docChanged) this.schedule(220);
        }
        schedule(ms: number) {
          clearTimeout(this.timer);
          this.timer = setTimeout(() => void this.fetch(), ms);
        }
        async fetch() {
          const doc = this.view.state.doc;
          try {
            client.sync();
            const [tokens, hints] = await Promise.all([
              client.request<object, { data: number[] }>('textDocument/semanticTokens/full', { textDocument: { uri } }),
              client.request<object, { position: { line: number; character: number }; label: string }[]>('textDocument/inlayHint', { textDocument: { uri }, range: { start: { line: 0, character: 0 }, end: { line: doc.lines, character: 0 } } }),
            ]);
            if (this.view.state.doc !== doc) return; // the document changed meanwhile
            const hintRanges = (hints ?? [])
              .filter((h) => h.position.line < doc.lines)
              .map((h) => Decoration.widget({ widget: new HintWidget(h.label), side: 1 }).range(Math.min(doc.line(h.position.line + 1).from + h.position.character, doc.length)));
            this.view.dispatch({ effects: [setTokens.of(decodeTokens(this.view.state, tokens?.data ?? [])), setHints.of(Decoration.set(hintRanges, true))] });
          } catch {
            /* the server may be restarting; the lexer highlighting stays */
          }
        }
        destroy() {
          clearTimeout(this.timer);
        }
      },
    ),
  ];
}

/** Lexer-only highlighting (read-only snippets without a server). */
export function lexerHighlighting(): Extension {
  return [
    tokenField,
    EditorView.updateListener.of((u) => {
      if (u.docChanged) u.view.dispatch({ effects: setTokens.of(decorationsFromLexer(u.state.doc.toString())) });
    }),
  ];
}

// ── Verdict seals in the gutter ──
const setVerdicts = StateEffect.define<RangedVerdict[]>();

class SealMarker extends GutterMarker {
  constructor(readonly verdicts: RangedVerdict[]) {
    super();
  }
  eq(o: SealMarker) {
    return o.verdicts.map((v) => v.status + v.subject).join() === this.verdicts.map((v) => v.status + v.subject).join();
  }
  toDOM() {
    const worst = this.verdicts.find((v) => v.status === 'violated') ?? this.verdicts.find((v) => v.status !== 'verified') ?? this.verdicts[0]!;
    const el = document.createElement('span');
    const kind = worst.status === 'violated' ? 'bad' : worst.status === 'verified' ? 'ok' : worst.badge.kind === 'tested' ? 'tested' : 'maybe';
    el.className = `seal seal-${kind}`;
    el.textContent = kind === 'bad' ? '✗' : kind === 'ok' ? '✓' : kind === 'tested' ? '◌' : '?';
    el.title = this.verdicts.map((v) => `${v.subject}: ${badgeText(v.badge)}`).join('\n');
    el.setAttribute('aria-label', el.title);
    return el;
  }
}

const verdictField = StateField.define<{ verdicts: RangedVerdict[]; markers: RangeSet<GutterMarker> }>({
  create: () => ({ verdicts: [], markers: RangeSet.empty }),
  update(v, tr) {
    for (const e of tr.effects) {
      if (e.is(setVerdicts)) {
        const byLine = new Map<number, RangedVerdict[]>();
        for (const x of e.value) if (x.range && x.range.start.line < tr.state.doc.lines) byLine.set(x.range.start.line, [...(byLine.get(x.range.start.line) ?? []), x]);
        const markers = [...byLine.entries()].sort((a, b) => a[0] - b[0]).map(([line, vs]) => new SealMarker(vs).range(tr.state.doc.line(line + 1).from));
        return { verdicts: e.value, markers: RangeSet.of(markers) };
      }
    }
    // Seals belong to the version that was verified: clear them on edit (new ones arrive with the next run).
    if (tr.docChanged) return { verdicts: [], markers: RangeSet.empty };
    return v;
  },
});

export function verdictGutter(onSelect?: (v: RangedVerdict) => void): Extension {
  return [
    verdictField,
    gutter({
      class: 'cm-seal-gutter',
      markers: (view) => view.state.field(verdictField).markers,
      domEventHandlers: {
        click: (view, line) => {
          const n = view.state.doc.lineAt(line.from).number - 1;
          const v = view.state.field(verdictField).verdicts.find((x) => x.range?.start.line === n);
          if (v) onSelect?.(v);
          return !!v;
        },
      },
    }),
  ];
}

export function showVerdicts(view: EditorView, p: VerdictsPayload): void {
  view.dispatch({ effects: setVerdicts.of(p.verdicts.flatMap((d) => d.verdicts)) });
}

// ── Locked regions ──
const lockedMark = Decoration.mark({ class: 'cm-locked', attributes: { title: 'This part is fixed by the exercise' } });

/** Make the given line ranges (1-based, inclusive) read-only. */
export function lockedLines(state: EditorState, ranges: [number, number][]): Extension {
  const deco = Decoration.set(
    ranges
      .filter(([a]) => a <= state.doc.lines)
      .map(([a, b]) => lockedMark.range(state.doc.line(a).from, state.doc.line(Math.min(b, state.doc.lines)).to)),
    true,
  );
  const field = StateField.define<DecorationSet>({
    create: () => deco,
    update: (d, tr) => (tr.docChanged ? d.map(tr.changes) : d),
    provide: (f) => EditorView.decorations.from(f),
  });
  return [
    field,
    EditorState.transactionFilter.of((tr) => {
      if (!tr.docChanged) return tr;
      const locked = tr.startState.field(field);
      let blocked = false;
      tr.changes.iterChangedRanges((from, to) => {
        locked.between(from, to, (lf, lt) => {
          if (from < lt && to > lf) blocked = true;
          else if (from === to && from > lf && from < lt) blocked = true;
        });
      });
      return blocked ? [] : tr;
    }),
  ];
}

// ── Theme ──
export const vouchTheme = EditorView.theme({
  '&': { fontSize: '0.86rem', backgroundColor: 'var(--panel)', color: 'var(--fg)' },
  '.cm-content': { fontFamily: 'var(--font-mono)', padding: '0.6rem 0', caretColor: 'var(--ink-blue)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.62' },
  '.cm-gutters': { backgroundColor: 'var(--pn)', color: 'var(--mute)', border: 'none', borderRight: '1px solid var(--line)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--ink-blue) 5%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--ink-blue) 10%, transparent)', color: 'var(--fg)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--term-hl-strong) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--ink-blue)', borderLeftWidth: '2px' },
  '.cm-tooltip': { backgroundColor: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: '6px', boxShadow: 'var(--shadow-lg)', fontFamily: 'var(--font-ui)', fontSize: '0.82rem', color: 'var(--fg)' },
  '.cm-tooltip code, .cm-tooltip pre': { fontFamily: 'var(--font-mono)', fontSize: '0.8rem' },
  '.cm-tooltip pre': { margin: '0.2rem 0', whiteSpace: 'pre-wrap' },
  '.cm-tooltip-hover': { padding: '0.45rem 0.65rem', maxWidth: '38rem' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--ink-blue-soft)', color: 'var(--fg)' },
  '.cm-diagnostic': { fontFamily: 'var(--font-ui)', fontSize: '0.82rem', padding: '0.3rem 0.6rem' },
  '.cm-diagnostic-error': { borderLeft: '3px solid var(--pencil)' },
  '.cm-diagnostic-warning': { borderLeft: '3px solid var(--maybe)' },
  '.cm-diagnostic-info': { borderLeft: '3px solid var(--ink-blue)' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--pencil)', textUnderlineOffset: '3px' },
  '.cm-lintRange-warning': { backgroundImage: 'none', textDecoration: 'underline wavy var(--maybe)', textUnderlineOffset: '3px' },
  '.cm-lintRange-info': { backgroundImage: 'none', textDecoration: 'underline dotted var(--ink-blue)', textUnderlineOffset: '3px' },
  '.cm-matchingBracket': { backgroundColor: 'var(--surface-3)', outline: 'none' },
  '.cm-seal-gutter': { width: '1.5rem' },
  '.cm-seal-gutter .cm-gutterElement': { display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  '.seal': { display: 'inline-grid', placeItems: 'center', width: '1.1rem', height: '1.1rem', borderRadius: '50%', fontSize: '0.7rem', fontWeight: '700', fontFamily: 'var(--font-ui)' },
  '.seal-ok': { color: 'var(--seal)', border: '1.5px double var(--seal)', backgroundColor: 'var(--seal-soft)' },
  '.seal-bad': { color: 'var(--pencil)', border: '1.5px solid var(--pencil)', backgroundColor: 'var(--pencil-soft)' },
  '.seal-tested': { color: 'var(--ink-blue)', border: '1.5px dashed var(--ink-blue)' },
  '.seal-maybe': { color: 'var(--maybe)', border: '1.5px dotted var(--maybe)' },
  '.cm-locked': { backgroundColor: 'color-mix(in srgb, var(--gold) 9%, transparent)' },
  '.vt-keyword': { color: 'var(--code-keyword)' },
  '.vt-spec': { color: 'var(--code-spec)', fontStyle: 'italic' },
  '.vt-number': { color: 'var(--code-number)' },
  '.vt-string': { color: 'var(--code-string)' },
  '.vt-function': { color: 'var(--code-fn)' },
  '.vt-type': { color: 'var(--code-type)' },
  '.vt-enumMember': { color: 'var(--code-number)' },
  '.vt-parameter': { color: 'var(--code-prop)' },
  '.vt-property': { color: 'var(--code-prop)' },
  '.vt-label': { color: 'var(--code-number)', fontWeight: '600' },
  '.vt-namespace': { color: 'var(--code-type)', fontWeight: '600' },
  '.vt-operator': { color: 'var(--code-punct)' },
  '.vt-comment': { color: 'var(--code-comment)', fontStyle: 'italic' },
  '.vt-ghost': { textDecoration: 'underline dotted color-mix(in srgb, currentColor 50%, transparent)' },
  '.vt-hint': { color: 'var(--mute)', fontSize: '0.78em', fontStyle: 'italic', padding: '0 0.15em' },
});

export { hoverTooltip };
