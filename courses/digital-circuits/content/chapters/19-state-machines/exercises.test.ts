import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { golfScore, runCheck, startCircuit, type BuildInput } from '$lib/components/exercise/circuit/spec';
import type { Circuit } from '$lib/sim/netlist/types';
import { toFsmInput } from './widgets/fsm';
import { DETECTOR, TRAFFIC_LIGHT, TURNSTILE } from './widgets/presets';

/**
 * The exercises of Chapter 19: every `build`, `debug` and `golf` block is solvable (its own solution passes the
 * checker within the rules of the exercise), and every starting circuit fails. The state tables written in the
 * blocks are the ones of the designer's presets, and the golf par is the cost of the solution.
 */
const here = fileURLToPath(new URL('./', import.meta.url));
const chapters = path.resolve(here, '..');
const md = readFileSync(path.join(here, 'index.md'), 'utf8');
const load = (p: string): Circuit => JSON.parse(readFileSync(path.join(chapters, p), 'utf8')) as Circuit;
const blocks = [...md.matchAll(/```(build|golf|debug)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, spec: YAML.parse(m[2]!) as BuildInput }));
for (const b of blocks) {
  if (typeof b.spec.solution === 'string') b.spec.solution = load(b.spec.solution);
  if (typeof b.spec.start === 'string') b.spec.start = load(b.spec.start);
}

describe('exercise blocks', () => {
  test('the chapter has a build, a debug and a golf exercise', () => {
    expect(blocks.map((b) => [b.kind, b.spec.id])).toEqual([['build', 'fsm/turnstile'], ['debug', 'fsm/traffic-light'], ['golf', 'fsm/detector-golf']]);
  });
  for (const b of blocks) {
    test(`${b.spec.id}: the solution passes, and is proven equivalent to the table`, () => {
      const r = runCheck(b.spec, b.spec.solution!);
      expect(r.problems, r.headline).toEqual([]);
      expect(r.violations).toEqual([]);
      expect(r.pass).toBe(true);
      expect(r.seq!.proven).toBe(true);
    });
    test(`${b.spec.id}: the starting circuit fails`, () => {
      expect(runCheck(b.spec, startCircuit(b.spec)).pass).toBe(false);
    });
  }
  test('the debug start has exactly one wrong part: an OR where the solution has an XOR', () => {
    const d = blocks.find((b) => b.kind === 'debug')!;
    const start = d.spec.start as Circuit;
    const sol = d.spec.solution as Circuit;
    const diff = start.components.filter((c) => JSON.stringify(c) !== JSON.stringify(sol.components.find((x) => x.id === c.id)));
    expect(diff.map((c) => [c.id, c.type])).toEqual([['X1', 'or']]);
    expect(sol.components.find((c) => c.id === 'X1')!.type).toBe('xor');
  });
  test('the golf solution scores exactly par (6: two flip-flops and four gates)', () => {
    const g = blocks.find((b) => b.kind === 'golf')!;
    const r = runCheck(g.spec, g.spec.solution!);
    expect(g.spec.par).toBe(6);
    expect(golfScore(g.spec, r.cost!)?.strokes).toBe(0);
    expect(r.cost!.byType).toMatchObject({ dff: 2 });
  });
  test('the state tables in the blocks are the designer’s machines', () => {
    const table = (id: string) => blocks.find((b) => b.spec.id === id)!.spec.spec!.fsm!;
    // Expand the block's patterns like the checker does and compare with the preset, state by state.
    const expand = (t: ReturnType<typeof toFsmInput>, ref: ReturnType<typeof toFsmInput>) => {
      for (const [name, st] of Object.entries(ref.states)) {
        for (const [bits, next] of Object.entries(st.next)) {
          const cand = t.states[name]!;
          const exact = cand.next[bits] ?? Object.entries(cand.next).find(([p]) => [...p].every((c, i) => c === '-' || c === bits[i]))?.[1];
          expect(exact, `${name} ${bits}`).toBe(next);
        }
        expect(t.states[name]!.out).toBe(st.out);
      }
    };
    expand(table('fsm/turnstile'), toFsmInput(TURNSTILE));
    expand(table('fsm/traffic-light'), toFsmInput(TRAFFIC_LIGHT));
    expand(table('fsm/detector-golf'), toFsmInput(DETECTOR));
  });
});
