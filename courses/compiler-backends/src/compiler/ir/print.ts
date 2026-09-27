import { type Line, type Tok, tok, sp, listingText } from '../listing';
import { Const, Instr, type Block, type Func, type Module, type Value, valueName } from './ir';

export interface IRPrintOpts {
  /** annotate blocks with predecessor lists */
  preds?: boolean;
  /** extra per-instruction comment */
  comment?: (i: Instr) => string | undefined;
}

export function valueTok(v: Value, fn?: Func): Tok {
  const name = valueName(v);
  if (v instanceof Const) return tok(name, 'imm', undefined, { kind: 'imm', value: v.v.toString() });
  const i = v as Instr;
  return tok(name, 'vreg', `v:${fn?.name ?? ''}:${i.id}`, {
    kind: 'value',
    name,
    type: i.type,
    def: i.op === 'param' ? `parameter #${i.index}` : describeDef(i),
    note: i.note,
  });
}

function describeDef(i: Instr): string {
  if (!i.block) return i.op;
  return `defined by '${i.op}${i.pred ? ' ' + i.pred : ''}' in ${i.block.name}`;
}

export const blockTok = (b: Block): Tok =>
  tok(b.name, 'label', `b:${b.fn.name}:${b.id}`, { kind: 'block', name: b.name, preds: b.preds.map((p) => p.name), succs: b.succs.map((s) => s.name) });

export function instrToks(i: Instr, fn: Func): Tok[] {
  const out: Tok[] = [];
  const v = (x: Value) => out.push(valueTok(x, fn));
  const comma = () => out.push(tok(', ', 'punct'));
  if (i.type !== 'void') out.push(valueTok(i, fn), tok(' = ', 'punct'));
  out.push(tok(i.op, 'kw', undefined, { kind: 'irop', op: i.op, pred: i.pred }));
  switch (i.op) {
    case 'icmp':
      out.push(sp, tok(i.pred!, 'op', undefined, { kind: 'irop', op: 'icmp', pred: i.pred }), sp);
      v(i.args[0]); comma(); v(i.args[1]);
      break;
    case 'phi':
      out.push(sp);
      i.args.forEach((a, k) => {
        if (k) comma();
        out.push(tok('[', 'punct'));
        v(a);
        out.push(tok(', ', 'punct'), blockTok(i.blocks[k]), tok(']', 'punct'));
      });
      break;
    case 'alloca':
      out.push(sp, tok(String(i.size), 'imm', undefined, { kind: 'imm', value: String(i.size), note: 'size in bytes' }));
      break;
    case 'gaddr':
      out.push(sp, tok('@' + i.sym, 'sym', `s:${i.sym}`, { kind: 'sym', name: i.sym!, what: 'global variable' }));
      break;
    case 'call':
      out.push(sp, tok('@' + i.sym, 'sym', `s:${i.sym}`, { kind: 'sym', name: i.sym!, what: 'function' }), tok('(', 'punct'));
      i.args.forEach((a, k) => { if (k) comma(); v(a); });
      out.push(tok(')', 'punct'));
      break;
    case 'br':
      out.push(sp, blockTok(i.blocks[0]));
      break;
    case 'condbr':
      out.push(sp); v(i.args[0]); comma(); out.push(blockTok(i.blocks[0])); comma(); out.push(blockTok(i.blocks[1]));
      break;
    default:
      if (i.args.length) out.push(sp);
      i.args.forEach((a, k) => { if (k) comma(); v(a); });
  }
  return out;
}

export function printFunc(fn: Func, opts: IRPrintOpts = {}): Line[] {
  const lines: Line[] = [];
  const params: Tok[] = [];
  fn.params.forEach((p, k) => {
    if (k) params.push(tok(', ', 'punct'));
    params.push(valueTok(p, fn));
  });
  lines.push({
    kind: 'header',
    toks: [tok('fn ', 'kw'), tok('@' + fn.name, 'sym', `s:${fn.name}`, { kind: 'sym', name: fn.name, what: 'function' }), tok('(', 'punct'), ...params, tok(') {', 'punct')],
    links: fn.line ? [`src:${fn.line}`] : [],
  });
  for (const b of fn.blocks) {
    const lbl: Tok[] = [blockTok(b), tok(':', 'punct')];
    if (opts.preds !== false && b.preds.length) lbl.push(tok(`    ; preds: ${b.preds.map((p) => p.name).join(', ')}`, 'comment'));
    lines.push({ kind: 'label', toks: lbl, key: `b:${fn.name}:${b.id}` });
    for (const i of b.instrs) {
      const toks = instrToks(i, fn);
      const c = opts.comment?.(i);
      if (c) toks.push(tok(`    ; ${c}`, 'comment'));
      lines.push({
        kind: 'instr',
        indent: 2,
        toks,
        key: `i:${fn.name}:${i.id}`,
        links: i.line ? [`src:${i.line}`] : [],
        note: i.note,
      });
    }
  }
  lines.push({ kind: 'header', toks: [tok('}', 'punct')] });
  return lines;
}

export function printModule(m: Module, opts: IRPrintOpts = {}): Line[] {
  const lines: Line[] = [];
  for (const g of m.globals) {
    const init = g.init.length ? ` = [${g.init.join(', ')}]` : '';
    lines.push({
      kind: 'directive',
      toks: [tok('global ', 'kw'), tok('@' + g.name, 'sym', `s:${g.name}`, { kind: 'sym', name: g.name, what: 'global variable' }), tok(` : [${g.words} x i64]${init}`, 'comment')],
      links: g.line ? [`src:${g.line}`] : [],
    });
  }
  if (m.globals.length) lines.push({ kind: 'blank', toks: [] });
  m.funcs.forEach((f, k) => {
    if (k) lines.push({ kind: 'blank', toks: [] });
    lines.push(...printFunc(f, opts));
  });
  return lines;
}

export const moduleText = (m: Module) => listingText(printModule(m));
export const funcText = (f: Func) => listingText(printFunc(f));
