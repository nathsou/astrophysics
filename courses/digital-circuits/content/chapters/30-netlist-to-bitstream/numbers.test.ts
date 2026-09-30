import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { check, elaborate } from '$lib/hdl';
import { lowerToNetlist } from '$lib/hdl/lower';
import { fromRtl, runFlow } from '$lib/pld/fpga';
import { fpgaExample } from '$lib/studio/fpga/examples';
import { runFpgaFlow } from '$lib/studio/fpga/result';
import { galAdapter } from '$lib/studio/adapters/gal';
import { cpldAdapter } from '$lib/studio/adapters/cpld';

/**
 * The numbers Chapter 30 quotes about the flow, checked against the code that produces them.
 *
 * The stages up to and including LUT mapping are deterministic functions of the design and their numbers are checked
 * exactly. Packing, placement, routing and timing are being tuned by the owner of the toolchain, and the figures in
 * the text (marked below) move with them, so those tests hold the *claims* the text makes, with margins; when the
 * toolchain changes for good, re-measure and update the figures in the text (they are all in one place each).
 */
vi.setConfig({ testTimeout: 300_000 });
const design = (src: string, top: string) => elaborate(check(src, { file: `${top}.dcl` }).program, top);
const src = (name: string) => readFileSync(new URL(`../../designs/${name}.dcl`, import.meta.url), 'utf8');

describe('the counter (Figure 30.1)', () => {
  const rtl = design(fpgaExample('counter')!.source, 'Counter');
  const r = runFpgaFlow(rtl);

  test('17 gates and four flip-flops in the netlist of Chapter 29', () => {
    const low = lowerToNetlist(rtl, undefined, { io: true });
    expect(low.stats.gates).toBe(17);
    expect(low.stats.flipFlops).toBe(4);
  });

  test('synthesis: 14 AND nodes, 13 after balancing, depth 4', () => {
    const f = runFlow(fromRtl(rtl), {});
    expect(f.synthTrace.passes.map((p) => [p.name, p.ands, p.depth])).toEqual([
      ['front end', 14, 4],
      ['sweep and rewrite', 14, 4],
      ['balance 1', 14, 4],
      ['balance 2', 13, 4],
    ]);
  });

  test('mapping: 5 LUTs, 2 levels (the optimum), then 6 cells: four flip-flops with their LUTs and two plain LUTs', () => {
    expect(r.report.sizes).toMatchObject({ andNodes: 13, aigDepth: 4, luts: 5, lutDepth: 2, optimalDepth: 2 });
    expect(r.cells.map((c) => c.kind).sort()).toEqual(['ff', 'ff', 'ff', 'ff', 'lut', 'lut']);
  });

  test('the enable and the clear are pins of the flip-flops, not LUT inputs', () => {
    const f = runFlow(fromRtl(rtl), {});
    const ff = f.netlist.lcs.filter((l) => l.ff);
    expect(ff).toHaveLength(4);
    const name = (n: number) => f.netlist.nets[n]!.name;
    for (const l of ff) {
      expect(name(l.ff!.ce)).toBe('enable');
      expect(name(l.ff!.sr)).toBe('clear');
      expect(l.inputs.map(name)).not.toContain('clear');
    }
  });

  test('one tile, 8 routed nets, a bitstream file of 277 bytes (fixed by the layout) with about 110 of 1,772 bits set', () => {
    expect(r.report.utilisation.tiles.used).toBe(1);
    expect(r.report.sizes.nets).toBe(8);
    expect(r.bitstream.length).toBe(277);
    const set = r.bits.reduce((a, b) => a + b, 0);
    expect(set).toBeGreaterThan(100);
    expect(set).toBeLessThan(120);
    expect(r.bits.length).toBe(1772);
  });

  test('timing: under 3 ns, over 300 MHz; the path is one or two LUTs between pins or flip-flops', () => {
    expect(r.report.timing.periodNs).toBeGreaterThan(1.5);
    expect(r.report.timing.periodNs).toBeLessThan(3);
    expect(r.report.timing.fmaxMHz).toBeGreaterThan(300);
    const luts = r.critical.steps.filter((s) => s.kind === 'cell' && s.name.endsWith('LUT')).length;
    expect(luts).toBeGreaterThanOrEqual(1);
    expect(luts).toBeLessThanOrEqual(2);
  });

  test('placement improves on the random start, and routing is done in a few iterations', () => {
    expect(r.place.steps.length).toBeGreaterThan(50);
    expect(r.place.bb).toBeLessThan(r.place.initial.bb);
    expect(r.route.iterations.length).toBeLessThanOrEqual(5);
    expect(r.route.success).toBe(true);
  });
});

describe('the mapper on bigger designs', () => {
  test('a 32-bit adder: 279 AND nodes; with the carry chain 32 cells; without it 71 LUTs 21 levels deep', () => {
    const rtl = design('module Add(a: bits<32>, b: bits<32>) -> (s: bits<32>) {\n  s = a + b\n}\n', 'Add');
    const on = runFlow(fromRtl(rtl), {});
    const off = runFlow(fromRtl(rtl), { carry: false });
    expect(on.report.sizes.andNodes).toBe(279);
    expect(on.report.utilisation.cells.used).toBe(32);
    expect(on.report.utilisation.carryCells).toBe(32);
    expect(off.report.utilisation.cells.used).toBe(71);
    expect(off.report.sizes.lutDepth).toBe(21);
    // The delays move with the placer and router; the claim is the ratio (about 8 ns against nearly 24 ns in the text).
    expect(off.report.timing.periodNs).toBeGreaterThan(2 * on.report.timing.periodNs);
    expect(on.report.timing.periodNs).toBeGreaterThan(7);
    expect(on.report.timing.periodNs).toBeLessThan(10);
    expect(off.report.timing.periodNs).toBeGreaterThan(20);
    expect(off.report.timing.periodNs).toBeLessThan(28);
  });

  test('the ALU: 2,114 AND nodes, 2,027 after balancing, depth 81 to 79; 645 LUTs 25 levels deep (the optimum); 679 cells, 34 of them carry cells', () => {
    const f = runFlow(fromRtl(design(src('alu'), 'Alu')), {});
    const p = f.synthTrace.passes;
    expect([p[0]!.ands, p[0]!.depth]).toEqual([2114, 81]);
    expect([p.at(-1)!.ands, p.at(-1)!.depth]).toEqual([2027, 79]);
    expect(f.report.sizes).toMatchObject({ luts: 645, lutDepth: 25, optimalDepth: 25 });
    expect(f.report.utilisation.cells.used).toBe(679);
    expect(f.report.utilisation.carryCells).toBe(34);
  });

  test('the hexadecimal counter of the board: 83 cells, 16 of them flip-flops, on the vFPGA-M', () => {
    const r = runFpgaFlow(design(fpgaExample('hex-counter')!.source, 'HexCounter'));
    expect(r.deviceName).toBe('vFPGA-M');
    expect(r.report.utilisation.cells.used).toBe(83);
    expect(r.report.utilisation.flipFlops).toBe(16);
  });
});

describe('placement, routing and timing of the ALU (the figures in the text move with the toolchain)', () => {
  const r = runFpgaFlow(design(src('alu'), 'Alu'));

  test('it fits the vFPGA-M, packed in fewer tiles than cells allow, and routes', () => {
    expect(r.deviceName).toBe('vFPGA-M');
    expect(r.report.utilisation.tiles.used * 8).toBeGreaterThanOrEqual(679);
    expect(r.route.success).toBe(true);
  });

  test('the annealer shortens the wirelength by well over a third, and the timing cost by an order of magnitude', () => {
    expect(r.place.bb).toBeLessThan(0.65 * r.place.initial.bb);
    expect(r.place.timing).toBeLessThan(0.15 * r.place.initial.timing);
    expect(r.place.steps.length).toBeGreaterThan(100);
  });

  test('the placer’s estimate of the critical path is within 10 % of the timing analysis after routing', () => {
    expect(Math.abs(r.place.estPeriod - r.report.timing.periodNs) / r.report.timing.periodNs).toBeLessThan(0.1);
  });

  test('PathFinder starts with hundreds of overused nodes and ends with none, and the count falls', () => {
    const o = r.route.iterations.map((i) => i.overused);
    expect(o[0]).toBeGreaterThan(200);
    expect(o.at(-1)).toBe(0);
    expect(o[Math.floor(o.length / 2)]!).toBeLessThan(o[0]!);
    expect(r.route.iterations.map((i) => i.presFac).every((v, i, a) => i === 0 || Math.abs(v / a[i - 1]! - 1.4) < 1e-6)).toBe(true);
    expect(r.route.iterations[0]!.presFac).toBe(0.5);
  });

  test('about half of the critical path is nets', () => {
    const nets = r.critical.steps.filter((s) => s.kind === 'net').reduce((a, s) => a + s.delay, 0);
    expect(nets / r.report.timing.periodNs).toBeGreaterThan(0.4);
    expect(nets / r.report.timing.periodNs).toBeLessThan(0.65);
  });
});

describe('one design, three chips (the table of Chapter 30)', () => {
  const eq = `# @title 4-bit counter
# @clock CLK
Q0.R = !CLR & (Q0 ^ EN)
Q1.R = !CLR & (Q1 ^ (EN & Q0))
Q2.R = !CLR & (Q2 ^ (EN & Q0 & Q1))
Q3.R = !CLR & (Q3 ^ (EN & Q0 & Q1 & Q2))
WRAPPED = EN & Q0 & Q1 & Q2 & Q3
`;
  test('GAL22V10: 5 of 10 macrocells, 15 product terms (2, 3, 4 and 5 for the registers), 53 fuses', () => {
    const g = galAdapter.program(eq);
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.fit.summary).toBe('5 of 10 macrocells, 15 of 130 product terms, 53 fuses connected');
    const rows = (g.fit.report.find((s) => s.title === 'Outputs') as { table: { rows: string[][] } }).table.rows;
    expect(Object.fromEntries(rows.map((r) => [r[0], r[4]]))).toEqual({ WRAPPED: '1/16', Q0: '2/14', Q1: '3/12', Q2: '4/10', Q3: '5/8' });
  });

  test('vCPLD-32: 5 of 32 macrocells, 9 product terms, T flip-flops with 2 terms each, in one function block', () => {
    const c = cpldAdapter.program(eq);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.fit.summary).toBe('5 of 32 macrocells, 9 of 160 product terms, 0 borrowed');
    const rows = (c.fit.report.find((s) => s.title === 'Outputs') as { table: { rows: string[][] } }).table.rows;
    expect(rows.filter((r) => r[3] === 'T flip-flop').map((r) => r[5])).toEqual(['2', '2', '2', '2']);
    const fbs = (c.fit.report.find((s) => s.title === 'Function blocks') as { table: { rows: string[][] } }).table.rows;
    expect(fbs.filter((r) => r[1] !== '0/8')).toHaveLength(1);
  });

  test('a 16-bit counter cannot fit a GAL22V10: 16 registers against 10 macrocells; bit 15 needs 17 terms against at most 16', () => {
    const q = Array.from({ length: 16 }, (_, i) => i);
    const lines = q.map((i) => `Q${i}.R = !CLR & (Q${i} ^ (EN${q.slice(0, i).map((j) => ` & Q${j}`).join('')}))`);
    const g = galAdapter.program(`# @title 16-bit counter\n# @clock CLK\n${lines.join('\n')}\n`);
    expect(g.ok).toBe(false);
  });
});
