/**
 * Highlighting from the compiler's lexer (`tokenize`), as a ViewPlugin. The whole text is re-tokenised when it
 * changes: DCL sources are small, the lexer never fails, and there is no incremental state to get wrong
 * (block comments, strings and doc comments cross lines), which is why this is not a StreamLanguage.
 */
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';
import { tokenize, type HighlightKind } from '../index';

const marks: Record<HighlightKind, Decoration | undefined> = {
  keyword: Decoration.mark({ class: 'cm-dcl-keyword' }),
  type: Decoration.mark({ class: 'cm-dcl-type' }),
  number: Decoration.mark({ class: 'cm-dcl-number' }),
  string: Decoration.mark({ class: 'cm-dcl-string' }),
  comment: Decoration.mark({ class: 'cm-dcl-comment' }),
  doc: Decoration.mark({ class: 'cm-dcl-doc' }),
  operator: Decoration.mark({ class: 'cm-dcl-operator' }),
  punctuation: Decoration.mark({ class: 'cm-dcl-punctuation' }),
  identifier: undefined,
  function: Decoration.mark({ class: 'cm-dcl-function' }),
  module: Decoration.mark({ class: 'cm-dcl-module' }),
};

function build(text: string): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  let pos = 0;
  for (const t of tokenize(text)) {
    const m = marks[t.kind];
    if (!m || t.from < pos || t.to > text.length || t.to <= t.from) continue;
    b.add(t.from, t.to, m);
    pos = t.to;
  }
  return b.finish();
}

export const dclTokens = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view.state.doc.toString());
    }
    update(u: ViewUpdate) {
      if (u.docChanged) this.decorations = build(u.state.doc.toString());
    }
  },
  { decorations: (v) => v.decorations },
);
