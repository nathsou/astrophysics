/** Shared helpers for the device adapters. */
import { ExprError } from '../../pld/twolevel/expr';
import { locateError } from '../source';
import type { SourceError } from '../types';

/** Turn whatever the toolchain threw into markers on the source. */
export function errorsFrom(e: unknown, source: string): SourceError[] {
  if (e instanceof ExprError) return [locateError(source, e.message)];
  if (e instanceof Error) {
    const info = (e as Error & { info?: { output?: string } }).info;
    return [locateError(source, e.message, info?.output ? { output: info.output } : undefined)];
  }
  return [{ line: 0, message: String(e) }];
}

export const bin = (v: number, width: number): string => v.toString(2).padStart(width, '0');

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export function ratio(used: number, of: number): string {
  return `${used} of ${of}`;
}

/** Levels for the run panel: a record over the given names from any lookup. */
export function record<T>(names: readonly string[], f: (name: string, i: number) => T): Record<string, T> {
  const out: Record<string, T> = {};
  names.forEach((n, i) => (out[n] = f(n, i)));
  return out;
}
