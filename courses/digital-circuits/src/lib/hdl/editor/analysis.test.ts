import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze } from './analysis';
import { completionsAt, definitionAt, hoverAt } from './queries';

const load = (f: string) => readFileSync(new URL(`../../../../content/designs/${f}`, import.meta.url), 'utf8');

describe('analyze', () => {
  it('describes a design: diagnostics, modules, declarations, costs', () => {
    const source = load('counter.dcl');
    const a = analyze({ source, file: 'counter.dcl', design: true, circuit: true, tests: true });
    expect(a.ok).toBe(true);
    expect(a.diagnostics).toEqual([]);
    expect(a.top).toBe('Counter');
    expect(a.design?.top).toBe('Counter');
    expect(a.circuit?.components.length).toBeGreaterThan(10);
    expect(a.stats?.flipFlops).toBe(4);
    expect(a.modules.find((m) => m.name === 'Counter')?.outputs.map((p) => p.name)).toEqual(['count', 'wrapped']);
    expect(a.modules.some((m) => m.std && m.name === 'Fifo')).toBe(true);
    expect(a.testOutcomes?.every((t) => t.passed)).toBe(true);
    expect(a.decls.find((d) => d.name === 'value')).toMatchObject({ kind: 'reg', type: 'bits<4>' });
    expect(a.decls.find((d) => d.name === 'value')?.cost).toContain('4 flip-flops');
    // The result crosses a worker boundary.
    expect(() => structuredClone(a)).not.toThrow();
  });

  it('keeps the diagnostics of a broken source, and no design', () => {
    const a = analyze({ source: 'module M(a: bits<4>) -> (y: bits<8>) {\n  y = a\n}\n', design: true });
    expect(a.ok).toBe(false);
    expect(a.diagnostics[0]!.code).toBe('width-mismatch');
    expect(a.rendered[0]).toContain('width mismatch');
    expect(a.design).toBeUndefined();
    expect(a.designError).toBeTruthy();
    const b = analyze({ source: 'module M(a: bits<4> {' });
    expect(b.ok).toBe(false);
  });

  it('reports why a big design is not drawn, but still gives its costs', () => {
    const a = analyze({ source: load('alu.dcl'), file: 'alu.dcl', circuit: { maxElements: 100 } });
    expect(a.ok).toBe(true);
    expect(a.circuit).toBeUndefined();
    expect(a.circuitError).toMatch(/too many/);
    expect(a.constructs.some((c) => c.kind === 'add')).toBe(true);
  });

  it('runs the tests and renders failures with their waveforms', () => {
    const source = load('counter.dcl').replace('expect c.count == 0', 'expect c.count == 3');
    const a = analyze({ source, file: 'counter.dcl', tests: true });
    const failed = a.testOutcomes!.find((t) => !t.passed)!;
    expect(failed.text).toContain('FAIL');
    expect(failed.failures[0]!.waveform!.signals.length).toBeGreaterThan(1);
  });
});

describe('queries', () => {
  const source = load('counter.dcl');
  const a = analyze({ source, file: 'counter.dcl' });
  const at = (s: string, k = 0) => source.indexOf(s) + k;

  it('hovers over names, with type, doc and cost', () => {
    const h = hoverAt(a, at('value: bits<4> = 0', 1))!;
    expect(h.signature).toBe('reg value: bits<4> = 0');
    expect(h.what).toBe('register');
    expect(h.cost).toContain('4 flip-flops');
    const port = hoverAt(a, at('enable: bit', 2))!;
    expect(port.signature).toBe('enable: bit');
    expect(port.what).toBe('input port');
    const m = hoverAt(a, at('Counter', 2))!;
    expect(m.doc).toContain('4-bit counter');
  });

  it('hovers over an operator with the hardware cost of the expression', () => {
    const h = hoverAt(a, at('value + 1', 6))!;
    expect(h.construct).toContain('4-bit incrementer');
    expect(h.construct).toContain('XOR');
    const eq = hoverAt(a, at('==', 0))!;
    expect(eq.construct).toContain('comparison');
    const lit = hoverAt(a, at('15'))!;
    expect(lit.signature).toBe('15 = 0xf = 0b1111');
  });

  it('completes keywords, names in scope, ports of an instance and members', () => {
    const top = 'module Top(clk: clock, go: bit) -> (n: bits<4>) {\n  inst c: Counter(clk: clk, enable: go, clear: 0)\n  n = c.count\n}\n';
    const src = `${source}\n${top}`;
    const b = analyze({ source: src, file: 'x.dcl' });
    expect(b.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    // Ports of the module being instantiated that are not connected yet (while typing, the source is broken).
    const typing = `${source}\nmodule Top(clk: clock, go: bit) -> (n: bits<4>) {\n  inst c: Counter(clk: clk, `;
    const t = analyze({ source: typing, file: 'x.dcl' });
    const conn = completionsAt(t, typing, typing.length)!;
    expect(conn.options.map((o) => o.label).sort()).toEqual(['clear', 'enable']);
    expect(conn.options[0]!.apply).toMatch(/: $/);
    // Members after a dot.
    const posDot = src.indexOf('n = c.') + 'n = c.'.length;
    expect(completionsAt(b, src.slice(0, posDot) + src.slice(posDot + 5), posDot)!.options.map((o) => o.label)).toEqual(['count', 'wrapped']);
    // Keywords at the start of a statement, in a module body.
    const line = src.indexOf('  n = c.count');
    const kw = completionsAt(b, src, line + 2)!;
    expect(kw.options.map((o) => o.label)).toEqual(expect.arrayContaining(['let', 'reg', 'next', 'inst']));
    // Module names after `inst x:`.
    const at = typing.indexOf('inst c: ') + 8;
    expect(completionsAt(t, typing.slice(0, at) + typing.slice(at + 7), at)!.options.map((o) => o.label)).toEqual(expect.arrayContaining(['Counter', 'Fifo']));
    // Names in scope inside an expression.
    const expr = 'module A(x: bits<4>) -> (y: bits<4>) {\n  reg r: bits<4> = 0\n  next r = r + ';
    const e = analyze({ source: expr });
    const opts = completionsAt(e, expr, expr.length)!.options.map((o) => o.label);
    expect(opts).toEqual(expect.arrayContaining(['x', 'r', 'concat', 'if']));
    expect(opts).not.toContain('y');
  });

  it('finds declarations', () => {
    const d = definitionAt(a, at('next value = if') + 6)!;
    expect(source.slice(d.from, d.to)).toBe('value');
  });
});
