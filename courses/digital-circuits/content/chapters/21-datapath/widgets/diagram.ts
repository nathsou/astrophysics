/**
 * Geometry of the datapath diagram, in two layouts: a wide one, with the bus across the middle and the blocks above and
 * below it, and a tall one for phones, with the bus running down the middle and the blocks on both sides. Pure data,
 * so the layouts can be tested (no overlaps, every stem reaches the bus).
 */
import type { Block } from './explorer';

export type Layout = 'wide' | 'tall';

export interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Stem {
  /** The block that drives (or listens) through this stem. */
  block: Block;
  /** 'drive' stems carry data to the bus, 'listen' stems from the bus. */
  kind: 'drive' | 'listen';
  /** From the block to the bus. */
  from: [number, number];
  to: [number, number];
  /** Hover text. */
  title: string;
}

export interface Geometry {
  width: number;
  height: number;
  bus: { x: number; y: number; w: number; h: number; vertical: boolean };
  boxes: Record<string, Box>;
  stems: Stem[];
  /** Connectors that do not go through the bus (A and B into the ALU). */
  links: { d: string; title: string }[];
}

/** Names, and which stems (drive / listen) each block has. */
export const STEM_INFO: { block: Block; box: string; kind: 'drive' | 'listen'; title: string; slot?: number }[] = [
  { block: 'SW', box: 'SW', kind: 'drive', title: 'Panel switches → bus (OE_SW)' },
  { block: 'PC', box: 'PC', kind: 'drive', title: 'PC → bus (OE_PC)' },
  { block: 'PC', box: 'PC', kind: 'listen', title: 'bus → PC (PC_LD)', slot: 1 },
  { block: 'SP', box: 'SP', kind: 'drive', title: 'SP → bus (OE_SP)' },
  { block: 'T', box: 'T', kind: 'drive', title: 'T → bus (OE_T)' },
  { block: 'T', box: 'T', kind: 'listen', title: 'bus → T (LD_T)', slot: 1 },
  { block: 'MAR', box: 'MAR', kind: 'listen', title: 'bus → MAR (LD_MAR)' },
  { block: 'MEM', box: 'MEM', kind: 'drive', title: 'M[MAR] → bus (OE_MEM)' },
  { block: 'MEM', box: 'MEM', kind: 'listen', title: 'bus → M[MAR] (MEM_WR)', slot: 1 },
  { block: 'IR', box: 'IR', kind: 'listen', title: 'bus → IR (LD_IR)' },
  { block: 'RD', box: 'RF', kind: 'drive', title: 'Rd → bus (OE_RD)', slot: 0 },
  { block: 'RS', box: 'RF', kind: 'drive', title: 'Rs → bus (OE_RS)', slot: 1 },
  { block: 'RF', box: 'RF', kind: 'listen', title: 'bus → Rd (WE_R)', slot: 2 },
  { block: 'A', box: 'A', kind: 'listen', title: 'bus → A (LD_A)' },
  { block: 'B', box: 'B', kind: 'listen', title: 'bus → B (LD_B)' },
  { block: 'ALU', box: 'ALU', kind: 'drive', title: 'ALU result → bus (OE_ALU)' },
];

function wide(): Geometry {
  const top = { y: 22, h: 62 };
  const bot = { y: 224, h: 62 };
  const boxes: Record<string, Box> = {};
  const put = (id: string, x: number, y: number, w: number, h: number) => (boxes[id] = { id, x, y, w, h });
  put('SW', 12, top.y, 86, top.h);
  put('PC', 110, top.y, 86, top.h);
  put('SP', 208, top.y, 86, top.h);
  put('T', 306, top.y, 86, top.h);
  put('MAR', 404, top.y, 86, top.h);
  put('MEM', 502, top.y, 146, top.h);
  put('RF', 12, bot.y, 200, 98);
  put('IR', 224, bot.y, 90, bot.h);
  put('A', 326, bot.y, 62, bot.h);
  put('B', 400, bot.y, 62, bot.h);
  put('ALU', 474, bot.y, 100, bot.h);
  put('FLAGS', 586, bot.y, 62, bot.h);
  const bus = { x: 8, y: 152, w: 644, h: 16, vertical: false };
  const stems: Stem[] = [];
  const cx = (b: Box, slot: number, n: number) => b.x + (b.w * (slot + 1)) / (n + 1);
  for (const s of STEM_INFO) {
    const b = boxes[s.box]!;
    const slots = STEM_INFO.filter((t) => t.box === s.box).length;
    const slot = s.slot ?? STEM_INFO.filter((t) => t.box === s.box).indexOf(s);
    const above = b.y < bus.y;
    const x = s.box === 'RF' ? b.x + [45, 105, 165][s.slot!]! : cx(b, slot, slots);
    const y0 = above ? b.y + b.h : b.y;
    const y1 = above ? bus.y : bus.y + bus.h;
    stems.push({ block: s.block, kind: s.kind, from: [x, y0], to: [x, y1], title: s.title });
  }
  const A = boxes.A!;
  const B = boxes.B!;
  const L = boxes.ALU!;
  const links = [
    { d: `M${A.x + A.w / 2} ${A.y + A.h}V${A.y + A.h + 16}H${L.x + 78}V${L.y + L.h}`, title: 'A → ALU' },
    { d: `M${B.x + B.w / 2} ${B.y + B.h}V${B.y + B.h + 8}H${L.x + 50}V${L.y + L.h}`, title: 'B → ALU' },
  ];
  return { width: 660, height: 326, bus, boxes, stems, links };
}

function tall(): Geometry {
  const boxes: Record<string, Box> = {};
  const put = (id: string, x: number, y: number, w: number, h: number) => (boxes[id] = { id, x, y, w, h });
  const bus = { x: 174, y: 8, w: 14, h: 574, vertical: true };
  const left = ['SW', 'PC', 'SP', 'T', 'MAR', 'IR'];
  left.forEach((id, i) => put(id, 8, 10 + i * 98, 136, 66));
  const right: [string, number][] = [['MEM', 66], ['RF', 116], ['A', 46], ['B', 46], ['ALU', 66], ['FLAGS', 46]];
  let y = 10;
  for (const [id, h] of right) {
    put(id, 218, y, 136, h);
    y += h + 28;
  }
  const stems: Stem[] = [];
  for (const s of STEM_INFO) {
    const b = boxes[s.box]!;
    const isLeft = b.x < bus.x;
    const slots = STEM_INFO.filter((t) => t.box === s.box);
    const slot = s.slot ?? slots.indexOf(s);
    const yy = s.box === 'RF' ? b.y + [26, 58, 90][s.slot!]! : b.y + (b.h * (slot + 1)) / (slots.length + 1);
    const x0 = isLeft ? b.x + b.w : b.x;
    const x1 = isLeft ? bus.x : bus.x + bus.w;
    stems.push({ block: s.block, kind: s.kind, from: [x0, yy], to: [x1, yy], title: s.title });
  }
  const A = boxes.A!;
  const B = boxes.B!;
  const L = boxes.ALU!;
  const rx = 218 + 136;
  const links = [
    { d: `M${rx} ${A.y + A.h / 2}H${rx + 8}V${L.y + 16}H${rx}`, title: 'A → ALU' },
    { d: `M${rx} ${B.y + B.h / 2}H${rx + 3}V${L.y + 44}H${rx}`, title: 'B → ALU' },
  ];
  return { width: 366, height: 590, bus, boxes, stems, links };
}

export const layout = (kind: Layout): Geometry => (kind === 'wide' ? wide() : tall());

import { DECODE_TABLE } from '$lib/sim/cpu/octet/spec';

/** An instruction byte as assembly with its operand fields decoded, e.g. 0x86 → `ADD R1, R2`. */
export function irText(ir: number | undefined): string {
  if (ir === undefined) return '?';
  const i = DECODE_TABLE[ir & 255]!;
  const d = (ir >> 2) & 3;
  const s = ir & 3;
  const op = (o: string) =>
    ({ rd: `R${d}`, rs: `R${s}`, '[rd]': `[R${d}]`, '[rs]': `[R${s}]`, imm: 'imm', '[addr]': '[addr]', addr: 'addr' })[o] ?? o;
  return i.operands.length ? `${i.mnemonic} ${i.operands.map(op).join(', ')}` : i.mnemonic;
}
