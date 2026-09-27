import type { Module } from '../ir/ir';
import { tok, type Line, type Tok } from '../listing';
import type { Target } from '../target/target';
import type { MFunc, MInstr } from './mir';

export interface MIRPrintOpts {
  /** final assembly form: no implicit-operand comments, directives included */
  asm?: boolean;
  post?: boolean;
  comments?: boolean;
}

function implicitComment(t: Target, mi: MInstr): string | undefined {
  const parts: string[] = [];
  if (mi.implUses?.length) parts.push(`uses ${mi.implUses.map((r) => t.regs[r].name).join(', ')}`);
  if (mi.implDefs?.length) parts.push(mi.implDefs.length > 4 ? `clobbers ${mi.implDefs.length} caller-saved regs` : `defines ${mi.implDefs.map((r) => (t.flags === r ? 'flags' : t.regs[r]?.name ?? 'flags')).join(', ')}`);
  return parts.length ? parts.join('; ') : undefined;
}

export function mirLine(f: MFunc, t: Target, mi: MInstr, opts: MIRPrintOpts = {}): Line {
  const toks: Tok[] = t.formatInstr(mi, f, !!opts.post);
  if (!opts.asm && opts.comments !== false) {
    const c = implicitComment(t, mi);
    if (c) toks.push(tok(`   ${t.commentChar} ${c}`, 'comment'));
  }
  return {
    kind: 'instr',
    indent: 4,
    toks,
    key: `m:${f.name}:${mi.id}`,
    links: [...(mi.ir !== undefined ? [`i:${f.name}:${mi.ir}`] : []), ...(mi.line ? [`src:${mi.line}`] : [])],
    note: mi.note,
    tag: mi.tag,
  };
}

export function printMFunc(f: MFunc, opts: MIRPrintOpts = {}): Line[] {
  const t = f.target;
  const lines: Line[] = [];
  if (opts.asm) {
    for (const d of t.asmPrologue(f.name)) lines.push({ kind: 'directive', indent: 4, toks: [tok(d, 'dir')] });
  }
  lines.push({
    kind: 'label',
    toks: [tok(t.name === 'aarch64' && t.opts.darwin ? '_' + f.name : f.name, 'sym', `s:${f.name}`, { kind: 'sym', name: f.name, what: 'function' }), tok(':', 'punct')],
    links: f.line ? [`src:${f.line}`] : [],
  });
  f.blocks.forEach((b, i) => {
    const referenced = f.blocks.some((x) => x.instrs.some((mi) => mi.ops.some((o) => o.k === 'block' && o.b === b)));
    if (i > 0 || !opts.asm) {
      if (i > 0 && opts.asm && !referenced) {
        lines.push({ kind: 'comment', toks: [tok(`${t.commentChar} %bb.${b.name}`, 'comment')] });
      } else if (i > 0 || !opts.asm) {
        const lbl = t.blockLabel(f, b);
        const extra = !opts.asm && b.loopDepth ? `  ${t.commentChar} loop depth ${b.loopDepth}` : '';
        const preds = !opts.asm && b.preds.length ? `  ${t.commentChar} preds: ${b.preds.map((p) => p.name).join(', ')}` : '';
        lines.push({
          kind: 'label',
          toks: [tok(lbl, 'label', `mb:${f.name}:${b.id}`, { kind: 'block', name: b.name, preds: b.preds.map((p) => p.name), succs: b.succs.map((s) => s.name) }), tok(':', 'punct'), tok(preds + extra, 'comment')],
          key: `mb:${f.name}:${b.id}`,
        });
      }
    }
    for (const mi of b.instrs) lines.push(mirLine(f, t, mi, opts));
  });
  if (opts.asm && t.name !== 'aarch64') lines.push({ kind: 'directive', indent: 4, toks: [tok(`.size ${f.name}, .-${f.name}`, 'dir')] });
  if (opts.asm && t.name === 'aarch64' && !t.opts.darwin) lines.push({ kind: 'directive', indent: 4, toks: [tok(`.size ${f.name}, .-${f.name}`, 'dir')] });
  return lines;
}

export function printGlobalsAsm(m: Module, t: Target): Line[] {
  const lines: Line[] = [];
  const data = m.globals.filter((g) => g.init.length), bss = m.globals.filter((g) => !g.init.length);
  const sym = (n: string) => (t.name === 'aarch64' && t.opts.darwin ? '_' + n : n);
  const D = (s: string) => lines.push({ kind: 'directive', indent: 4, toks: [tok(s, 'dir')] });
  const L = (n: string, line?: number) => lines.push({ kind: 'label', toks: [tok(sym(n), 'sym', `s:${n}`, { kind: 'sym', name: n, what: 'global variable' }), tok(':', 'punct')], links: line ? [`src:${line}`] : [] });
  if (data.length) {
    D('.data');
    for (const g of data) {
      D(`.globl ${sym(g.name)}`);
      D('.p2align 3');
      L(g.name, g.line);
      D(`.quad ${g.init.join(', ')}`);
      if (g.words > g.init.length) D(`.zero ${(g.words - g.init.length) * 8}`);
    }
  }
  if (bss.length) {
    D('.bss');
    for (const g of bss) {
      D(`.globl ${sym(g.name)}`);
      D('.p2align 3');
      L(g.name, g.line);
      D(`.zero ${g.words * 8}`);
    }
  }
  return lines;
}
