import { SourceFile, type Span } from './span';

export type Severity = 'error' | 'warning' | 'note';

/** A secondary location shown under the primary one ("first assigned here"). */
export interface Label {
  span: Span;
  label: string;
}

/**
 * A compiler message. `span` and `label` point at the problem; `notes` explain the hardware reason and
 * `help` proposes an explicit fix, as in HDL.md, *Diagnostics*.
 */
export interface Diagnostic {
  severity: Severity;
  /** A stable identifier for tests and the editor, such as `width-mismatch`. */
  code: string;
  message: string;
  span: Span;
  label?: string;
  secondary?: Label[];
  notes?: string[];
  help?: string[];
}

export function hasErrors(diags: readonly Diagnostic[]): boolean {
  return diags.some((d) => d.severity === 'error');
}

/** Collects diagnostics, dropping exact duplicates (generic modules are checked once per instantiation). */
export class DiagnosticSink {
  readonly list: Diagnostic[] = [];
  private seen = new Set<string>();
  /** When > 0, diagnostics are discarded (speculative checking). */
  muted = 0;

  add(d: Diagnostic): void {
    if (this.muted > 0) return;
    const key = `${d.severity}|${d.code}|${d.span.file}|${d.span.start}|${d.span.end}|${d.message}|${d.label ?? ''}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.list.push(d);
  }

  error(code: string, message: string, span: Span, label?: string, extra: Partial<Diagnostic> = {}): void {
    this.add({ severity: 'error', code, message, span, label, ...extra });
  }

  warning(code: string, message: string, span: Span, label?: string, extra: Partial<Diagnostic> = {}): void {
    this.add({ severity: 'warning', code, message, span, label, ...extra });
  }

  get errorCount(): number {
    return this.list.filter((d) => d.severity === 'error').length;
  }
}

function snippet(src: SourceFile, span: Span, label: string | undefined, gutter: number, header: string): string[] {
  const out: string[] = [];
  const pad = ' '.repeat(gutter);
  out.push(`${pad} ${header} ${span.file}:${span.line}:${span.col}`);
  const text = src.lineText(span.line);
  out.push(`${String(span.line).padStart(gutter)} │ ${text}`.trimEnd());
  const lineEnd = src.lineStarts[span.line - 1]! + text.length;
  const endCol = Math.max(span.col + 1, Math.min(span.end, lineEnd) - src.lineStarts[span.line - 1]! + 1);
  const carets = '^'.repeat(Math.max(1, endCol - span.col));
  out.push(`${pad} │ ${' '.repeat(span.col - 1)}${carets}${label ? ' ' + label : ''}`);
  return out;
}

/**
 * Renders a diagnostic in the style of HDL.md:
 *
 * ```
 * error: width mismatch
 *    ┌─ riscv32.dcl:58:36
 * 58 │   let next_pc: bits<32> = pc + imm_12
 *    │                                ^^^^^^ bits<12>, expected bits<32>
 *    = help: extend it explicitly: sext(imm_12, 32) or zext(imm_12, 32)
 * ```
 */
export function renderDiagnostic(source: string | SourceFile, d: Diagnostic): string {
  const src = typeof source === 'string' ? new SourceFile(d.span.file, source) : source;
  const lines = [d.span.line, ...(d.secondary ?? []).map((s) => s.span.line)];
  const gutter = Math.max(2, ...lines.map((l) => String(l).length));
  const pad = ' '.repeat(gutter);
  const out = [`${d.severity}: ${d.message}`];
  out.push(...snippet(src, d.span, d.label, gutter, '┌─'));
  for (const s of d.secondary ?? []) out.push(...snippet(src, s.span, s.label, gutter, '├─'));
  for (const n of d.notes ?? []) out.push(`${pad} = note: ${n}`);
  for (const h of d.help ?? []) out.push(`${pad} = help: ${h}`);
  return out.join('\n');
}

export function renderDiagnostics(source: string, diags: readonly Diagnostic[]): string {
  const src = new SourceFile(diags[0]?.span.file ?? 'input.dcl', source);
  return diags.map((d) => renderDiagnostic(src, d)).join('\n\n');
}
