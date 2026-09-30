/** Format on demand: `formatResult` (the compiler's formatter), applied as a minimal edit so the cursor stays put. */
import type { EditorView } from '@codemirror/view';
import { formatResult } from '../index';

export type FormatOutcome = 'changed' | 'unchanged' | 'error';

/** Replaces the document with its formatted text. A source with syntax errors is left alone ('error'). */
export function formatDocument(view: EditorView): FormatOutcome {
  const text = view.state.doc.toString();
  const r = formatResult(text);
  if (r.diagnostics.some((d) => d.severity === 'error')) return 'error';
  if (!r.changed) return 'unchanged';
  const out = r.output;
  let start = 0;
  while (start < text.length && start < out.length && text[start] === out[start]) start++;
  let endA = text.length;
  let endB = out.length;
  while (endA > start && endB > start && text[endA - 1] === out[endB - 1]) {
    endA--;
    endB--;
  }
  view.dispatch({ changes: { from: start, to: endA, insert: out.slice(start, endB) }, userEvent: 'input.format' });
  return 'changed';
}
