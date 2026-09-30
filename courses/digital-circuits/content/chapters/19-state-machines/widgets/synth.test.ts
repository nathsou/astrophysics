import { describe, expect, test } from 'vitest';
import { check, elaborate, createRtlSim } from '$lib/hdl';
import { allInputs, mealyToMoore, step, type Fsm } from './fsm';
import { toDcl, moduleName } from './dcl';
import { DETECTOR, PRESETS, TRAFFIC_LIGHT, VENDING } from './presets';
import { codeText, compareEncodings, encode, evalLogic, synthesise, verify, type Encoding } from './synth';
import { toSnake } from './fsm';

const ENC: Encoding[] = ['binary', 'gray', 'onehot'];

function stream(n: number, len: number, seed: number): number[][] {
  let a = seed;
  const r = () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) >>> 8) & 0xffff;
  return Array.from({ length: len }, () => Array.from({ length: n }, () => (r() & 1 ? 1 : 0)));
}

describe('encodings', () => {
  test('codes', () => {
    const b = encode(TRAFFIC_LIGHT, 'binary');
    expect([b.bits, ...Object.values(b.code)]).toEqual([2, 0, 1, 2, 3]);
    const g = encode(TRAFFIC_LIGHT, 'gray');
    expect(Object.values(g.code).map((c) => codeText(c, g.bits))).toEqual(['00', '01', '11', '10']);
    const o = encode(TRAFFIC_LIGHT, 'onehot');
    expect([o.bits, ...Object.values(o.code)]).toEqual([4, 1, 2, 4, 8]);
    expect(o.names[0]).toBe('Q_Amber');
  });
  test('Gray neighbours differ in one bit', () => {
    const g = encode({ ...TRAFFIC_LIGHT, states: Array.from({ length: 8 }, (_, i) => ({ name: 'S' + i, out: '000' })) }, 'gray');
    const codes = Object.values(g.code);
    for (let i = 1; i < 8; i++) expect((codes[i]! ^ codes[i - 1]!).toString(2).replace(/0/g, '')).toBe('1');
  });
});

describe('synthesis', () => {
  for (const p of PRESETS) {
    for (const e of ENC) {
      test(`${p.id} / ${e}: the logic does exactly what the diagram says`, () => {
        expect(verify(synthesise(p.fsm, e))).toBeNull();
      });
    }
  }
  test('the Moore version of a Mealy machine, and random machines, also verify', () => {
    for (const f of [mealyToMoore(DETECTOR), mealyToMoore(VENDING)]) for (const e of ENC) expect(verify(synthesise(f, e))).toBeNull();
    let a = 7;
    const r = () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) >>> 8) / 16777216;
    for (let t = 0; t < 6; t++) {
      const ns = 3 + Math.floor(r() * 6);
      const states = Array.from({ length: ns }, (_, i) => ({ name: 'S' + i, out: r() < 0.5 ? '1' : '0' }));
      const transitions = states.flatMap((s) => [0, 1].map((m) => ({ from: s.name, to: 'S' + Math.floor(r() * ns), when: String(m) })));
      const f: Fsm = { title: 'r', kind: 'moore', inputs: ['a'], outputs: ['z'], states, transitions };
      for (const e of ENC) expect(verify(synthesise(f, e))).toBeNull();
    }
  });
  test('the numbers quoted in the chapter', () => {
    const t = compareEncodings(TRAFFIC_LIGHT);
    expect(ENC.map((e) => [t[e].cost.flipFlops, t[e].cost.gates, t[e].cost.total, t[e].cost.widest])).toEqual([
      [2, 10, 12, 3],
      [2, 13, 15, 2],
      [4, 15, 19, 2],
    ]);
    const d = compareEncodings(DETECTOR);
    expect(ENC.map((e) => d[e].cost.total)).toEqual([8, 12, 16]);
  });
  test('one-hot logic never has a wide gate, however many states', () => {
    const ring = (n: number): Fsm => ({
      title: 'ring', kind: 'moore', inputs: ['go'], outputs: ['z'],
      states: Array.from({ length: n }, (_, i) => ({ name: 'S' + i, out: i === n - 1 ? '1' : '0' })),
      transitions: Array.from({ length: n }, (_, i) => ({ from: 'S' + i, to: 'S' + ((i + 1) % n), when: '1' })),
    });
    for (const n of [4, 8, 12]) {
      const c = compareEncodings(ring(n));
      expect(c.onehot.cost.widest).toBeLessThanOrEqual(2);
      expect(c.binary.cost.widest).toBeGreaterThan(2);
      expect(c.binary.cost.luts).toBeLessThanOrEqual(c.onehot.cost.luts + 4);
    }
    // ...but binary needs far fewer flip-flops, and in this model fewer gates too.
    const c = compareEncodings(ring(12));
    expect(c.binary.cost.flipFlops).toBe(4);
    expect(c.onehot.cost.flipFlops).toBe(12);
    expect(c.binary.cost.total).toBeLessThan(c.onehot.cost.total);
  });
  test('the Gray traffic light is a two-bit Johnson counter: equations', () => {
    const s = synthesise(TRAFFIC_LIGHT, 'gray');
    expect(s.functions).toEqual(['D_Q1', 'D_Q0', 'red', 'amber', 'green']);
    expect(s.equations[2]).toBe('!Q1');
    expect(s.equations[4]).toBe('Q1 & Q0');
  });
  test('evalLogic follows the ring', () => {
    const s = synthesise(TRAFFIC_LIGHT, 'gray');
    let code = 0;
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      code = evalLogic(s, code, [1]).next;
      seen.push(codeText(code, 2));
    }
    expect(seen).toEqual(['01', '11', '10', '00', '01']);
  });
  test('errors are reported', () => {
    expect(() => synthesise({ ...TRAFFIC_LIGHT, states: [TRAFFIC_LIGHT.states[0]!] }, 'binary')).toThrow(/two states/);
  });
});

describe('state assignment', () => {
  const perms = <T,>(a: T[]): T[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  test('the 24 binary assignments of the 1011 detector cost between 4 and 11 gates (Idle first: 4 to 11 as well)', () => {
    const gates = perms(DETECTOR.states).map((st) => synthesise({ ...DETECTOR, states: st }, 'binary').cost.gates);
    expect(gates).toHaveLength(24);
    expect(Math.min(...gates)).toBe(4);
    expect(Math.max(...gates)).toBe(11);
    const best = synthesise({ ...DETECTOR, states: ['Idle', 'Got10', 'Got101', 'Got1'].map((n) => DETECTOR.states.find((s) => s.name === n)!) }, 'binary');
    expect(best.equations).toEqual(['x', '!Q0 & x | Q1', 'Q1 & !Q0 & x']);
    expect(best.cost).toMatchObject({ flipFlops: 2, gates: 4, total: 6 });
  });
});

describe('the DCL text', () => {
  test('module names', () => {
    expect(moduleName('UART receiver (control)')).toBe('UartReceiverControl');
    expect(moduleName('Sequence detector 1011')).toBe('SequenceDetector1011');
    expect(moduleName('1 bit')).toBe('M1Bit');
  });
  for (const p of PRESETS) {
    for (const e of ENC) {
      test(`${p.id} / ${e}: compiles without diagnostics and matches the diagram cycle by cycle`, () => {
        const code = toDcl(p.fsm, e);
        const r = check(code, { file: 'fsm.dcl' });
        expect(r.diagnostics.map((d) => d.message)).toEqual([]);
        const sim = createRtlSim(elaborate(r.program, moduleName(p.fsm.title)));
        let s = p.fsm.states[0]!.name;
        const ins = p.fsm.inputs.map(toSnake);
        const outs = p.fsm.outputs.map(toSnake);
        for (const v of stream(ins.length, 300, 11)) {
          ins.forEach((n, i) => sim.set(n, v[i]!));
          const want = step(p.fsm, s, v);
          expect(outs.map((o) => sim.get(o)).join('')).toBe(want.out);
          sim.step();
          s = want.next;
        }
      });
    }
  }
  test('every input combination is exercised for the vending machine', () => {
    const code = toDcl(VENDING, 'binary');
    const r = check(code);
    const sim = createRtlSim(elaborate(r.program, 'VendingMachine'));
    for (const st of VENDING.states) {
      for (const v of allInputs(2)) {
        sim.reset();
        // Walk to the state, then compare one cycle.
        const path = { Empty: [], Has5: [[1, 0]], Has10: [[0, 1]] }[st.name]!;
        for (const w of path) {
          sim.set('five', w[0]!);
          sim.set('ten', w[1]!);
          sim.step();
        }
        sim.set('five', v[0]!);
        sim.set('ten', v[1]!);
        expect(String(sim.get('dispense'))).toBe(step(VENDING, st.name, v).out);
      }
    }
  });
  test('the attribute chooses the encoding', () => {
    expect(toDcl(TRAFFIC_LIGHT, 'binary')).not.toMatch(/@/);
    expect(toDcl(TRAFFIC_LIGHT, 'gray')).toMatch(/^@gray enum State/m);
    expect(toDcl(TRAFFIC_LIGHT, 'onehot')).toMatch(/^@onehot enum State/m);
  });
});
