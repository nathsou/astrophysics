// Tokenise plain assembly text (from encoder listings) into hoverable tokens.

import { tok, type Line, type Tok } from '../compiler/listing';
import type { ListingEntry, ObjectCode } from '../compiler/emit/objcode';
import { targetFor } from '../ui/explain';

export function asmTokens(text: string, target: string): Tok[] {
  const t = targetFor(target);
  const regIdx = new Map<string, number>();
  t?.regs.forEach((r, i) => { regIdx.set(r.name, i); regIdx.set(r.arch, i); });
  if (target === 'x86_64') ['al', 'cl', 'dl', 'bl', 'spl', 'bpl', 'sil', 'dil'].forEach((n, i) => regIdx.set(n, i));
  const out: Tok[] = [];
  const m = /^(\S+)(\s*)(.*)$/.exec(text);
  if (!m) return [tok(text)];
  const [, mn, sp, rest] = m;
  out.push(tok(mn, 'kw', undefined, { kind: 'mop', target, op: mn }));
  if (sp) out.push(tok(sp));
  const commentAt = rest.search(/\s#\s|\s\/\/\s/);
  const body = commentAt >= 0 ? rest.slice(0, commentAt) : rest;
  const comment = commentAt >= 0 ? rest.slice(commentAt) : '';
  const re = /(%\w+\([^)]*\)|[A-Za-z_.][\w.$@]*|-?0x[0-9a-fA-F]+|-?\d+|\s+|.)/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(body))) {
    const s = mm[0];
    if (/^\s+$/.test(s)) out.push(tok(s));
    else if (regIdx.has(s)) out.push(tok(s, 'preg', `r:${target}:${regIdx.get(s)}`, { kind: 'reg', target, reg: regIdx.get(s)! }));
    else if (/^-?(0x[0-9a-fA-F]+|\d+)$/.test(s)) out.push(tok(s, 'imm', undefined, { kind: 'imm', value: BigInt(s).toString() }));
    else if (s.startsWith('%')) out.push(tok(s, 'sym'));
    else if (/^[A-Za-z_.]/.test(s)) out.push(tok(s, s.startsWith('.L') || s.startsWith('L') ? 'label' : 'sym', s.startsWith('.L') ? undefined : `s:${s}`));
    else out.push(tok(s, 'punct'));
  }
  if (comment) out.push(tok(comment, 'comment'));
  return out;
}

const hex2 = (b: number) => b.toString(16).padStart(2, '0');

export function listingLines(obj: ObjectCode, target: string, opts: { section?: string } = {}): Line[] {
  const lines: Line[] = [];
  const entries = obj.listing.filter((e) => (opts.section ? e.section === opts.section : e.section === '.text'));
  for (const e of entries) lines.push(entryLine(e, target));
  return lines;
}

export function entryLine(e: ListingEntry, target: string): Line {
  if (e.label) {
    return { kind: 'label', toks: [tok(e.label, e.label.startsWith('.L') || e.label.startsWith('L') ? 'label' : 'sym', `s:${e.label}`), tok(':', 'punct')], addr: e.addr };
  }
  const bytes = target === 'x86_64' ? e.bytes.map(hex2).join(' ') : e.bytes.length === 4 ? ((e.bytes[0] | (e.bytes[1] << 8) | (e.bytes[2] << 16) | (e.bytes[3] << 24)) >>> 0).toString(16).padStart(8, '0') : e.bytes.map(hex2).join(' ');
  const toks = asmTokens(e.text, target);
  if (e.reloc) toks.push(tok(`   ↳ ${e.reloc.typeName} ${e.reloc.sym}`, 'comment'));
  return {
    kind: 'instr',
    toks,
    addr: e.addr,
    bytes,
    key: e.mi !== undefined ? `x:${e.fn}:${e.mi}:${e.addr}` : undefined,
    links: e.mi !== undefined ? [`m:${e.fn}:${e.mi}`] : [],
    note: e.expandedFrom ? `expanded from the pseudo-instruction '${e.expandedFrom}'${e.note ? ` — ${e.note}` : ''}` : e.note ?? e.reloc?.why,
  };
}
