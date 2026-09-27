// Machine-code emission: turn final MIR into encoded bytes + relocations.

import type { Module } from '../ir/ir';
import type { MFunc, MOperand } from '../codegen/mir';
import type { Target } from '../target/target';
import type { ObjectCode } from './objcode';
import { assembleRV, type AOperand, type AsmItem } from './rv64asm';
import { emitA64 } from './a64enc';
import { emitX64 } from './x64enc';
import { lineText } from '../listing';
import { mirLine } from '../codegen/printmir';

export type { ObjectCode } from './objcode';

export function globalDataItems(m: Module): AsmItem[] {
  const items: AsmItem[] = [];
  const data = m.globals.filter((g) => g.init.length), bss = m.globals.filter((g) => !g.init.length);
  if (data.length) {
    items.push({ k: 'section', name: '.data' });
    for (const g of data) {
      items.push({ k: 'align', pow: 3 }, { k: 'label', name: g.name, global: true, kind: 'object' });
      const bytes: number[] = [];
      for (let w = 0; w < g.words; w++) {
        let v = BigInt.asUintN(64, g.init[w] ?? 0n);
        for (let k = 0; k < 8; k++) { bytes.push(Number(v & 0xffn)); v >>= 8n; }
      }
      items.push({ k: 'data', bytes, text: `.quad ${g.init.join(', ')}` });
    }
  }
  if (bss.length) {
    items.push({ k: 'section', name: '.bss' });
    for (const g of bss) items.push({ k: 'align', pow: 3 }, { k: 'label', name: g.name, global: true, kind: 'object' }, { k: 'zero', n: g.words * 8 });
  }
  return items;
}

export function rvItems(t: Target, funcs: MFunc[], m: Module): AsmItem[] {
  const items: AsmItem[] = [{ k: 'section', name: '.text' }];
  for (const f of funcs) {
    items.push({ k: 'align', pow: 2 }, { k: 'label', name: f.name, global: true, kind: 'func' });
    f.blocks.forEach((b, i) => {
      if (i > 0) items.push({ k: 'label', name: t.blockLabel(f, b) });
      for (const mi of b.instrs) {
        const conv = (o: MOperand): AOperand => {
          switch (o.k) {
            case 'preg': return { k: 'reg', r: o.r };
            case 'imm': return { k: 'imm', v: o.v };
            case 'block': return { k: 'label', name: t.blockLabel(f, o.b) };
            case 'sym': return { k: 'label', name: o.name };
            case 'mem':
              if (o.base.k !== 'preg') throw new Error(`unresolved memory base in ${f.name}`);
              return { k: 'mem', base: o.base.r, disp: BigInt(o.disp) };
            default: throw new Error(`cannot emit operand ${o.k} in ${f.name} (${mi.op})`);
          }
        };
        items.push({ k: 'instr', fn: f.name, ins: { op: mi.op, ops: mi.ops.map(conv), mi: mi.id, note: mi.note } });
      }
    });
  }
  return [...items, ...globalDataItems(m)];
}

export function emitModule(t: Target, funcs: MFunc[], m: Module): ObjectCode | undefined {
  switch (t.name) {
    case 'rv64': return assembleRV(rvItems(t, funcs, m));
    case 'aarch64': return emitA64(t, funcs, m, (mi, f) => lineText(mirLine(f, t, mi, { asm: true })).trim());
    case 'x86_64': return emitX64(t, funcs, m, (mi, f) => lineText(mirLine(f, t, mi, { asm: true })).trim());
  }
}
