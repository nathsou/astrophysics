/** DCL diagnostics as CodeMirror diagnostics. */
import type { Diagnostic as CmDiagnostic } from '@codemirror/lint';
import type { Analysis } from './analysis';

/** The diagnostics of an analysis, clamped to a document of `length` characters. */
export function toCmDiagnostics(a: Analysis, length: number): CmDiagnostic[] {
  return a.diagnostics.map((d, i) => {
    let from = Math.min(d.span.start, length);
    let to = Math.min(Math.max(d.span.end, from), length);
    if (to === from) {
      // A diagnostic at the end of a line or of the file: underline the character before.
      if (from > 0 && a.source[from - 1] !== '\n') from--;
      else to = Math.min(length, to + 1);
    }
    return {
      from,
      to,
      severity: d.severity === 'note' ? 'info' : d.severity,
      source: d.code,
      message: [d.label && d.label !== d.message ? `${d.message}: ${d.label}` : d.message, ...(d.notes ?? []).map((n) => `note: ${n}`), ...(d.help ?? []).map((h) => `help: ${h}`)].join('\n'),
      renderMessage: () => {
        const el = document.createElement('div');
        const head = document.createElement('strong');
        head.textContent = d.label && d.label !== d.message ? `${d.message}: ${d.label}` : d.message;
        el.append(head);
        for (const line of [...(d.notes ?? []).map((n) => `note: ${n}`), ...(d.help ?? []).map((h) => `help: ${h}`)]) {
          const p = document.createElement('div');
          p.textContent = line;
          p.style.color = 'var(--ink-2)';
          el.append(p);
        }
        el.dataset.diagnostic = String(i);
        return el;
      },
    };
  });
}
