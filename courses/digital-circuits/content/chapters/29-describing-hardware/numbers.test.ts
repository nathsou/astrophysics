/**
 * The chapter’s numbers and quotations are the real ones: every gate count is measured by lowering the
 * design with the compiler, and every excerpt of the compiler or of its output in the text is checked
 * against the source or against a fresh run.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze } from '$lib/hdl/editor/analysis';
import { check, elaborate, flattenRtl, printRtl, createRtlSim } from '$lib/hdl';
import { fencedBlocks } from './fences';

const md = readFileSync(new URL('./index.md', import.meta.url), 'utf8');
const design = (name: string) => readFileSync(new URL(`../../designs/${name}.dcl`, import.meta.url), 'utf8');
const stats = (source: string, top?: string) => {
  const a = analyze({ source, file: 'design.dcl', top, circuit: { maxElements: 100000 } });
  expect(a.ok, a.rendered.join('\n')).toBe(true);
  return { stats: a.stats!, constructs: a.constructs };
};
const counter = design('counter');

describe('the numbers in the text', () => {
  it('a 32-bit adder is 154 gates with a longest path of 63', () => {
    const { stats: s } = stats('module Add(a: bits<32>, b: bits<32>) -> (y: bits<32>) { y = a + b }');
    expect(s.gates).toBe(154);
    expect(s.depth).toBe(63);
  });

  it('the ALU is 1,180 gates in 1,281 elements, and the match is its biggest line', () => {
    const { stats: s, constructs } = stats(design('alu'));
    expect(s.gates).toBe(1180);
    expect(s.elements).toBe(1281);
    expect(s.depth).toBe(69);
    const biggest = [...constructs].sort((a, b) => b.total - a.total)[0]!;
    expect(biggest.kind).toBe('pmux');
    expect(biggest.total).toBe(304);
    const sum = (kinds: string[]) => constructs.filter((c) => kinds.includes(c.kind)).reduce((n, c) => n + c.total, 0);
    expect(sum(['add'])).toBe(217);
    expect(sum(['shr'])).toBe(212);
    expect(sum(['shl'])).toBe(160);
    expect(constructs.map((c) => c.total)).toContain(154);
  });

  it('the register file has 992 flip-flops and about 3,900 gates; Fifo<8, 4> has 39 flip-flops', () => {
    const rf = stats(design('regfile'), 'RegFile').stats;
    expect(rf.flipFlops).toBe(992);
    expect(Math.round(rf.gates / 100) * 100).toBe(3900);
    const fifo = stats('module T(clk: clock, push: bit, data_in: bits<8>, pop: bit) -> (data_out: bits<8>) {\n  inst f: Fifo<8, 4>(clk: clk, push: push, data_in: data_in, pop: pop)\n  data_out = f.data_out\n}').stats;
    expect(fifo.flipFlops).toBe(39);
  });

  it('the shift register has one flip-flop per stage and no gates', () => {
    const delay = (n: number) =>
      stats(`module Delay<STAGES: int>(clk: clock, d: bit) -> (q: bit) {
  reg stages: [bit; STAGES] = [0; STAGES]
  next stages[0] = d
  for i in 1..STAGES {
    next stages[i] = stages[i - 1]
  }
  q = stages[STAGES - 1]
}
module T(clk: clock, d: bit) -> (q: bit) {
  inst x: Delay<${n}>(clk: clk, d: d)
  q = x.q
}`).stats;
    expect([delay(3).flipFlops, delay(3).gates]).toEqual([3, 0]);
    expect([delay(8).flipFlops, delay(8).gates]).toEqual([8, 0]);
  });

  it('the counter and the lab: 17 gates, 4 flip-flops, depth 5, and what each edit changes', () => {
    const base = stats(counter).stats;
    expect([base.gates, base.flipFlops, base.depth]).toEqual([17, 4, 5]);
    const wide = stats(counter.replace(/bits<4>/g, 'bits<8>').replace('== 15', '== 255'));
    expect([wide.stats.flipFlops, wide.stats.depth]).toEqual([8, 9]);
    const inc = wide.constructs.find((c) => c.kind === 'add')!;
    expect(inc.counts).toMatchObject({ and: 6, xor: 7, not: 1 });
    const plus3 = stats(counter.replace('value + 1', 'value + 3'));
    expect(plus3.constructs.find((c) => c.kind === 'add')!.counts).toMatchObject({ and: 2, or: 1, xor: 3, not: 2 });
    expect(plus3.stats.gates).toBe(19);
    expect(stats(counter.replace('value + 1', 'value * 3')).stats.gates).toBe(19);
    const noClear = stats(counter.replace('if clear { 0 } else if enable', 'if enable')).stats;
    expect([noClear.gates, noClear.depth]).toEqual([12, 4]);
    const first = stats(counter).constructs.find((c) => c.kind === 'add')!;
    expect(first.counts).toMatchObject({ and: 2, xor: 3, not: 1 });
  });

  it('the traffic light is 2 flip-flops and 13 gates, and @onehot makes 4 flip-flops', () => {
    const tl = design('traffic-light');
    const s = stats(tl).stats;
    expect([s.flipFlops, s.gates]).toEqual([2, 13]);
    expect(stats(tl.replace('enum Light', '@onehot enum Light')).stats.flipFlops).toBe(4);
  });

  it('the ROM holds eight seven-segment patterns and the chapter’s digit patterns are the standard library’s', () => {
    const rom = fencedBlocks(md, 'dcl').find((b) => b.code.includes('mem table'))!.code;
    const std = readFileSync(new URL('../../../src/lib/hdl/std/seven-seg.dcl', import.meta.url), 'utf8');
    const patterns = [...rom.split('\n').find((l) => l.includes('mem table'))!.matchAll(/0x[0-9a-f]{2}/g)].map((m) => parseInt(m[0], 16));
    expect(patterns).toEqual([0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07]);
    for (const [i, p] of patterns.entries()) expect(std).toContain(`0x${i.toString(16)} => 0b${(p >> 4).toString(2).padStart(3, '0')}_${(p & 15).toString(2).padStart(4, '0')}`);
  });
});

describe('the excerpts in the text', () => {
  const norm = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
  const excerpt = (file: string) => norm(readFileSync(new URL(`../../../src/lib/hdl/${file}`, import.meta.url), 'utf8'));
  const codeBlocks = (lang: string) => fencedBlocks(md, lang).map((b) => norm(b.code));

  it('the lexer, checker and lowering excerpts are verbatim', () => {
    const ts = codeBlocks('ts');
    expect(ts.length).toBe(4);
    const sources = [excerpt('lexer.ts'), excerpt('lexer.ts'), excerpt('check.ts'), excerpt('lower/builder.ts')];
    ts.forEach((block, i) => expect(sources[i]!.includes(block), `ts block ${i}`).toBe(true));
  });

  it('the RTL print of the counter is what printRtl prints', () => {
    const r = check(counter, { file: 'counter.dcl' });
    const printed = printRtl(flattenRtl(elaborate(r.program, 'Counter'), 'Counter'));
    expect(codeBlocks('text')).toContain(norm(printed));
  });

  it('the generated JavaScript is what the RTL simulator generates', () => {
    const sources: string[] = [];
    const Original = globalThis.Function;
    const spy = new Proxy(Original, {
      construct(target, args, newTarget) {
        sources.push(String(args[args.length - 1]));
        return Reflect.construct(target, args, newTarget);
      },
    });
    (globalThis as { Function: unknown }).Function = spy;
    try {
      const r = check(counter, { file: 'counter.dcl' });
      const sim = createRtlSim(elaborate(r.program, 'Counter'), 'Counter');
      sim.set('enable', 1);
      sim.step(3);
      expect(sim.get('count')).toBe(3);
    } finally {
      (globalThis as { Function: unknown }).Function = Original;
    }
    const js = codeBlocks('js');
    expect(js.length).toBe(2);
    const generated = sources.map(norm);
    for (const block of js) expect(generated, block).toContain(block);
  });
});
