/**
 * Diagnostics from every stage of the Vouch front end and the verifier. Codes are stable (docs/VOUCH.md lists
 * them) so that exercises and tests can refer to them; messages are written for learners.
 */
import type { Span } from './syntax/lexer';

export type Severity = 'error' | 'warning' | 'info' | 'hint';

export interface Related {
  span: Span;
  message: string;
}

export interface Diagnostic {
  severity: Severity;
  /** Stable code, e.g. `parse/expected`, `type/mismatch`, `verify/postcondition`. */
  code: string;
  message: string;
  span: Span;
  related?: Related[];
}

export function diag(severity: Severity, code: string, message: string, span: Span, related?: Related[]): Diagnostic {
  return related ? { severity, code, message, span, related } : { severity, code, message, span };
}

export const hasErrors = (ds: readonly Diagnostic[]) => ds.some((d) => d.severity === 'error');
