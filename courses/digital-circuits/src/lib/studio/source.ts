/**
 * The Studio's source text: equations or truth tables with optional `# @pragma` comment lines.
 *
 * ```
 * # @title Traffic-light controller
 * # @pins CAR=2 T=3 Q1=19
 * # @polarity Q1=low
 * Q1.R = Q1 ^ Q0          registered output (level after the next clock edge)
 * MG = !Q1 & !Q0          combinational output
 * ```
 *
 * Pragmas are ordinary comments to every parser (`#` at the start of a line), so a source with pragmas is
 * still a valid file for the underlying tools. This module reads them, finds where each output is defined
 * (for cross-probing) and turns fitter errors into line-numbered markers.
 */
import { ExprError, parseExpr } from '../pld/twolevel/expr';
import type { SourceError } from './types';

export interface Pragmas {
  title?: string;
  pins: Record<string, number>;
  /** Per-output polarity; `all` is the blanket `# @polarity auto`. */
  polarity: Record<string, 'auto' | 'high' | 'low'>;
  polarityAll?: 'auto' | 'high';
  clock?: string;
  buried: string[];
  inputs?: string[];
  ff: Record<string, 'auto' | 'D' | 'T'>;
  init: Record<string, 0 | 1>;
  signature?: string;
  usercode?: string;
  goe: string[];
  /** Names given to the address inputs of a PROM, most significant first. */
  address?: string[];
  /** Don't-care conditions: outputs matching a pattern (`Sa`, `S*`, `*`) ignore inputs where the expression is true. */
  dc: { patterns: string[]; expr: string }[];
}

/** Does an output name match a `# @dc` pattern (`name`, `prefix*`, `*`)? */
export function matchesPattern(name: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('*')) return name.startsWith(pattern.slice(0, -1));
  return name === pattern;
}

const PRAGMA = /^\s*#\s*@(\w+)\s*(.*)$/;

export function parsePragmas(source: string): Pragmas {
  const p: Pragmas = { pins: {}, polarity: {}, buried: [], ff: {}, init: {}, goe: [], dc: [] };
  const pairs = (rest: string) =>
    rest
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((s) => s.split('=') as [string, string | undefined]);
  for (const line of source.split(/\r\n|\n|\r/)) {
    const m = PRAGMA.exec(line);
    if (!m) continue;
    const [, key, rest] = m as unknown as [string, string, string];
    switch (key.toLowerCase()) {
      case 'title':
        p.title = rest.trim();
        break;
      case 'signature':
        p.signature = rest.trim();
        break;
      case 'usercode':
        p.usercode = rest.trim();
        break;
      case 'clock':
        p.clock = rest.trim().split(/\s+/)[0];
        break;
      case 'buried':
        p.buried.push(...rest.split(/[\s,]+/).filter(Boolean));
        break;
      case 'goe':
        p.goe.push(...rest.split(/[\s,]+/).filter(Boolean));
        break;
      case 'inputs':
        p.inputs = rest.split(/[\s,]+/).filter(Boolean);
        break;
      case 'address':
        p.address = rest.split(/[\s,]+/).filter(Boolean);
        break;
      case 'dc': {
        const at = rest.indexOf(':');
        if (at > 0) p.dc.push({ patterns: rest.slice(0, at).split(/[\s,]+/).filter(Boolean), expr: rest.slice(at + 1).trim() });
        break;
      }
      case 'pins':
        for (const [k, v] of pairs(rest)) if (v !== undefined && /^\d+$/.test(v)) p.pins[k] = Number(v);
        break;
      case 'polarity':
        for (const [k, v] of pairs(rest)) {
          if (v === undefined) {
            if (k === 'auto' || k === 'high') p.polarityAll = k;
          } else if (v === 'auto' || v === 'high' || v === 'low') p.polarity[k] = v;
        }
        break;
      case 'ff':
        for (const [k, v] of pairs(rest)) if (v === 'auto' || v === 'D' || v === 'T') p.ff[k] = v;
        break;
      case 'init':
        for (const [k, v] of pairs(rest)) if (v === '0' || v === '1') p.init[k] = Number(v) as 0 | 1;
        break;
    }
  }
  return p;
}

const stripComment = (raw: string) => raw.replace(/;.*$/, '').replace(/\/\/.*$/, '');
const isComment = (raw: string) => /^\s*#/.test(raw);

/** True if the source is a truth table (`A B | Y` header) rather than equations. */
export function isTruthTable(source: string): boolean {
  for (const raw of source.split(/\r\n|\n|\r/)) {
    const line = raw.replace(/(\/\/|#).*$/, '').trim();
    if (!line) continue;
    return line.includes('|') && !line.includes('=');
  }
  return false;
}

/** The 1-based line of each output's definition (`Y = …`, `Y.R = …`), or of the header of a truth table. */
export function definitionLines(source: string): Record<string, number> {
  const out: Record<string, number> = {};
  const lines = source.split(/\r\n|\n|\r/);
  if (isTruthTable(source)) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.replace(/(\/\/|#).*$/, '').trim();
      if (!line) continue;
      const [, outs] = line.split('|');
      for (const name of (outs ?? '').trim().split(/\s+/).filter(Boolean)) out[name] = i + 1;
      break;
    }
    return out;
  }
  lines.forEach((raw, i) => {
    if (isComment(raw)) return;
    const line = stripComment(raw);
    for (const part of line.split(';')) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)(?:\.([A-Za-z]+))?\s*=/.exec(part);
      if (m && out[m[1]!] === undefined) out[m[1]!] = i + 1;
    }
  });
  return out;
}

/** Check every equation line's syntax; the errors carry line numbers. */
export function lintEquations(source: string): SourceError[] {
  const errors: SourceError[] = [];
  source.split(/\r\n|\n|\r/).forEach((raw, i) => {
    if (isComment(raw)) return;
    const line = stripComment(raw);
    if (!line.trim()) return;
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)(?:\.([A-Za-z]+))?\s*=(.*)$/.exec(line);
    if (!m) {
      errors.push({ line: i + 1, message: 'Expected “name = expression”' });
      return;
    }
    try {
      parseExpr(m[3]!);
    } catch (e) {
      if (e instanceof ExprError) errors.push({ line: i + 1, message: `${e.message} (at character ${m[0]!.length - m[3]!.length + e.offset + 1})` });
      else throw e;
    }
  });
  return errors;
}

/** Turn a fitter error message into a marker on the line it is about. */
export function locateError(source: string, message: string, hint?: { output?: string }): SourceError {
  const explicit = /^Line (\d+):\s*(.*)$/s.exec(message);
  if (explicit) return { line: Number(explicit[1]), message: explicit[2]! };
  const defs = definitionLines(source);
  const lines = source.split(/\r\n|\n|\r/);
  if (hint?.output && defs[hint.output]) return { line: defs[hint.output]!, message };
  // "Equation for Y: unknown signal "Z"" — the output named first.
  const lead = /^(?:Equation for|Output enable of|Don't-care set of|Output)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(message);
  if (lead && defs[lead[1]!]) return { line: defs[lead[1]!]!, message };
  // A signal named in quotes ("Z"): the first line that mentions it.
  const quoted = /(?:signal|input|output|name) ["“]([A-Za-z_][A-Za-z0-9_]*)["”]/.exec(message) ?? /"([A-Za-z_][A-Za-z0-9_]*)"/.exec(message);
  if (quoted) {
    const re = new RegExp(`\\b${quoted[1]}\\b`);
    const at = lines.findIndex((l) => !isComment(l) && re.test(stripComment(l)));
    if (at >= 0) return { line: at + 1, message };
  }
  // Any output name mentioned in the message.
  for (const name of Object.keys(defs)) if (new RegExp(`\\b${name}\\b`).test(message)) return { line: defs[name]!, message };
  return { line: 0, message };
}
