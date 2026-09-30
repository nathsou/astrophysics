import { describe, expect, test } from 'vitest';
import { SwitchBuilder, createSwitchEngine } from './index';

/**
 * The 28-transistor mirror full adder: the carry and sum pull-down networks and their mirror-image
 * pull-ups (the functions are self-dual), then two inverters.
 *
 *   carry̅ = ¬(A·B + Cin·(A + B))
 *   sum̅   = ¬(A·B·Cin + carry̅·(A + B + Cin))
 */
function mirrorFullAdder(b: SwitchBuilder, id: string, a: number, bb: number, c: number, s: number, co: number): void {
  const vdd = b.vdd();
  const gnd = b.gnd();
  const cob = b.net(`${id}.cob`);
  const sb = b.net(`${id}.sb`);
  let k = 0;
  const n = (g: number, d: number, src: number) => b.nmos(`${id}.n${k++}`, g, d, src);
  const p = (g: number, src: number, d: number) => b.pmos(`${id}.p${k++}`, g, src, d);
  // Carry: A·B | Cin·(A + B), and the mirror.
  const n1 = b.net();
  n(a, cob, n1);
  n(bb, n1, gnd);
  const n2 = b.net();
  n(c, cob, n2);
  n(a, n2, gnd);
  n(bb, n2, gnd);
  const p1 = b.net();
  p(a, vdd, p1);
  p(bb, p1, cob);
  const p2 = b.net();
  p(a, vdd, p2);
  p(bb, vdd, p2);
  p(c, p2, cob);
  // Sum: carry̅·(A + B + Cin) | A·B·Cin, and the mirror.
  const n3 = b.net();
  n(cob, sb, n3);
  n(a, n3, gnd);
  n(bb, n3, gnd);
  n(c, n3, gnd);
  const n4 = b.net();
  const n5 = b.net();
  n(a, sb, n4);
  n(bb, n4, n5);
  n(c, n5, gnd);
  const p3 = b.net();
  p(a, vdd, p3);
  p(bb, vdd, p3);
  p(c, vdd, p3);
  p(cob, p3, sb);
  const p4 = b.net();
  const p5 = b.net();
  p(a, vdd, p4);
  p(bb, p4, p5);
  p(c, p5, sb);
  b.inv(`${id}.ic`, cob, co);
  b.inv(`${id}.is`, sb, s);
}

describe('CMOS ripple-carry adder', () => {
  test('a 1-bit mirror adder has 28 transistors and adds', () => {
    const b = new SwitchBuilder();
    const [a, bb, c] = ['A', 'B', 'C'].map((id) => b.input(id)) as [number, number, number];
    const s = b.net('S');
    const co = b.net('CO');
    mirrorFullAdder(b, 'FA', a, bb, c, s, co);
    const net = b.build();
    expect(net.elements.filter((e) => e.type === 'nmos' || e.type === 'pmos')).toHaveLength(28);
    const e = createSwitchEngine(net);
    for (let m = 0; m < 8; m++) {
      ['A', 'B', 'C'].forEach((id, i) => e.setParam(id, 'on', ((m >> i) & 1) === 1));
      const sum = (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
      expect([e.logic(s), e.logic(co)]).toEqual([sum & 1, sum >> 1]);
    }
  });

  test('4 bits, all 512 input combinations', () => {
    const b = new SwitchBuilder();
    const A = [0, 1, 2, 3].map((i) => b.input(`A${i}`));
    const B = [0, 1, 2, 3].map((i) => b.input(`B${i}`));
    let carry = b.input('CIN');
    const S = b.nets(4, 'S');
    for (let i = 0; i < 4; i++) {
      const co = b.net(`C${i + 1}`);
      mirrorFullAdder(b, `FA${i}`, A[i]!, B[i]!, carry, S[i]!, co);
      carry = co;
    }
    const net = b.build();
    const e = createSwitchEngine(net);
    const ids = [...A.map((_, i) => `A${i}`), ...B.map((_, i) => `B${i}`), 'CIN'];
    let prev = 0;
    const t0 = performance.now();
    for (let m = 0; m < 512; m++) {
      // Flip only the inputs that change (each flip settles the circuit).
      ids.forEach((id, i) => {
        if (((m ^ prev) >> i) & 1) e.setParam(id, 'on', ((m >> i) & 1) === 1);
      });
      prev = m;
      const want = (m & 15) + ((m >> 4) & 15) + (m >> 8);
      const got = S.reduce((acc, n, i) => acc + (e.logic(n) << i), 0) + (e.logic(carry) << 4);
      expect(got, `${m & 15} + ${(m >> 4) & 15} + ${m >> 8}`).toBe(want);
    }
    const ms = performance.now() - t0;
    expect(e.messages).toEqual([]);
    console.log(`4-bit mirror adder (112 transistors): 512 combinations in ${ms.toFixed(1)} ms, ${e.roundCount} rounds`);
  });
});
