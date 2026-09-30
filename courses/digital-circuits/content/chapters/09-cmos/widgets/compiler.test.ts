import { describe, expect, test } from 'vitest';
import { compile, evalNnf, evaluate, ExprError, nnf, parse, rows, gateSignals, show, showNet, totalWidth, variables, widths } from './compiler';
import { gateCircuit, mainStageConduction, verify } from './gate';
import { cellFor, transistorsOf } from '$lib/sim/expand/cells';

const tt = (src: string) => rows(compile(src)).map((r) => r.expected).join('');

describe('parsing', () => {
  test('precedence: NOT, then AND, then XOR, then OR', () => {
    expect(show(parse('A + B*C'))).toBe('A + B·C');
    expect(show(parse('(A + B)*C'))).toBe('(A + B)·C');
    expect(show(parse('!A*B'))).toBe('¬A·B');
    expect(show(parse('!(A*B)'))).toBe('¬(A·B)');
  });

  test('every spelling of the operators', () => {
    const want = tt('!(A*(B+C))');
    for (const s of ['¬(A·(B+C))', '~(A&(B|C))', '!(A∧(B∨C))', "(A(B+C))'", 'Y = !(A (B + C))', 'y=!(a.(b+c))']) expect(tt(s), s).toBe(want);
  });

  test('implicit AND and postfix primes', () => {
    expect(tt("AB'+A'B")).toBe(tt('A^B'));
    expect(tt('ABC')).toBe('00000001');
  });

  test('XOR is sugar for A·¬B + ¬A·B', () => {
    expect(tt('A^B')).toBe('0110');
    expect(tt('A⊕B⊕C')).toBe('01101001');
    expect(tt('A+B^C')).toBe(tt('A+(B^C)')); // XOR binds tighter than OR
  });

  test('variables are collected, sorted and case-insensitive', () => {
    expect(variables(parse('c + a*B'))).toEqual(['A', 'B', 'C']);
  });

  test.each([
    ['', /Type an expression/],
    ['A +', /ends too soon/],
    ['(A + B', /never closed/],
    ['A + B)', /no opening/],
    ['*A', /needs something in front/],
    ['A $ B', /symbol/],
    ['A + 1', /Constants/],
  ])('%j is refused politely', (src, msg) => {
    expect(() => parse(src)).toThrow(ExprError);
    expect(() => parse(src)).toThrow(msg);
  });

  test('errors say where', () => {
    try {
      parse('A + $');
    } catch (e) {
      expect((e as ExprError).at).toBe(4);
    }
  });
});

describe('negation normal form', () => {
  const exprs = ['!(A*(B+C))', 'A^B', '!(A^B^C)', "!(!A + B*!C)", 'A*!(B+!C)*D', '!!A'];
  test('De Morgan keeps the function, with or without a negation on top', () => {
    for (const s of exprs) {
      const e = parse(s);
      for (const r of rows({ expr: e, inputs: variables(e) })) {
        expect(evalNnf(nnf(e, false), r.env), s).toBe(evaluate(e, r.env));
        expect(evalNnf(nnf(e, true), r.env), s).toBe(1 - evaluate(e, r.env));
      }
    }
  });
});

describe('the classic gates and their transistor counts', () => {
  test.each([
    ['!A', 2, 'single'],
    ['!(A*B)', 4, 'single'],
    ['!(A+B)', 4, 'single'],
    ['!(A*B*C)', 6, 'single'],
    ['!(A+B+C+D)', 8, 'single'],
    ['A*B', 6, 'inverted'],
    ['A+B', 6, 'inverted'],
    ['A', 4, 'single'],
    ['!(A*(B+C))', 6, 'single'],
    ['!(A*B+C)', 6, 'single'],
    ['!(A*B+C*D)', 8, 'single'],
    ['A^B', 12, 'single'],
    ['!(A^B)', 12, 'single'],
    ['!(A*B + C*(A+B))', 10, 'single'],
  ])('%s takes %i transistors (%s)', (src, n, strategy) => {
    const c = compile(src);
    expect(c.transistors).toBe(n);
    expect(c.strategy).toBe(strategy);
    expect(transistorsOf(c.cell)).toHaveLength(n);
  });

  test('the compiler agrees with the library cells for NAND, NOR and NOT', () => {
    expect(compile('!(A*B*C)').cell.stages).toEqual(cellFor('nand', 3).stages);
    expect(compile('!(A+B)').cell.stages).toEqual(cellFor('nor', 2).stages);
    expect(compile('!A').cell.stages).toEqual(cellFor('not', 1).stages);
    expect(compile('A*B').cell.stages.map((s) => s.out)).toEqual(cellFor('and', 2).stages.map((s) => s.out));
  });

  test('the pull-up is the dual of the pull-down', () => {
    const c = compile('!(A*(B+C))');
    expect(c.pdn).toEqual({ series: [{ leaf: 'A' }, { parallel: [{ leaf: 'B' }, { leaf: 'C' }] }] });
    expect(c.pun).toEqual({ parallel: [{ leaf: 'A' }, { series: [{ leaf: 'B' }, { leaf: 'C' }] }] });
  });

  test('factoring saves transistors: A·(B+C) against A·B + A·C', () => {
    expect(compile('!(A*(B+C))').transistors).toBe(6);
    expect(compile('!(A*B + A*C)').transistors).toBe(8);
  });

  test('too big is refused', () => {
    expect(() => compile('A+B+C+D+E+F')).toThrow(/too big/);
    expect(() => compile('A^B^C^D')).toThrow(/transistors/);
  });
});

describe('sizing: why NAND beats NOR', () => {
  const w = (s: string) => totalWidth(compile(s).cell);
  test('the unit inverter is 3 wide: nMOS 1, pMOS 2', () => {
    expect(widths(compile('!A').cell)).toEqual([2, 1]);
    expect(w('!A')).toBe(3);
  });
  test('NAND2 is 8, NOR2 is 10', () => {
    expect(widths(compile('!(A*B)').cell)).toEqual([2, 2, 2, 2]);
    expect(widths(compile('!(A+B)').cell)).toEqual([4, 4, 1, 1]);
    expect(w('!(A*B)')).toBe(8);
    expect(w('!(A+B)')).toBe(10);
  });
  test('the gap widens with the number of inputs', () => {
    expect([3, 4].map((n) => [w(`!(${'ABCD'.slice(0, n).split('').join('*')})`), w(`!(${'ABCD'.slice(0, n).split('').join('+')})`)])).toEqual([
      [15, 21],
      [24, 36],
    ]);
  });
});

describe('the drawn gate runs on the switch-level engine', () => {
  const sources = [
    '!A', 'A', '!(A*B)', '!(A+B)', 'A*B', 'A+B', '!(A*B*C)', '!(A+B+C)', '!(A*(B+C))', '!(A*B+C)', '!(A*B+C*D)', '!((A+B)*(C+D))',
    'A^B', '!(A^B)', 'A^B^C', '!(A*B + C*(A+B))', '!(S*A + !S*B)', '(A+B)*(C+D)', 'A*!B', '!(A*!B + !A*B)', 'A*B + C*D + E',
  ];
  test.each(sources)('Y = %s: every row agrees with the expression, and nothing fights or floats', (src) => {
    const c = compile(src);
    const v = verify(c);
    expect(v.rows).toHaveLength(1 << c.inputs.length);
    expect(v.rows.filter((r) => !r.ok).map((r) => r.bits.join(''))).toEqual([]);
    expect(v.ok).toBe(true);
    expect(v.clean).toBe(true);
  });

  test('a driven output is driven, never merely charged', () => {
    const v = verify(compile('!(A*(B+C))'));
    expect(new Set(v.rows.map((r) => r.strength))).toEqual(new Set(['driven']));
  });

  test('the drawing has exactly the compiler’s transistors', () => {
    for (const src of ['!(A*(B+C))', 'A^B', 'A*B']) {
      const c = compile(src);
      const g = gateCircuit(c);
      expect(g.transistors).toHaveLength(c.transistors);
      expect(g.circuit.components.filter((p) => p.type === 'nmos' || p.type === 'pmos')).toHaveLength(c.transistors);
      expect(g.drawn.components.some((p) => p.type === 'frame')).toBe(true);
      expect(g.circuit.components.some((p) => p.type === 'frame')).toBe(false);
    }
  });

  test('exactly one network conducts in every row: no static current', () => {
    for (const src of ['!(A*(B+C))', 'A^B', 'A*B', '!(A*B + C*(A+B))', 'A*(B+!C)']) {
      const c = compile(src);
      for (const r of rows(c)) {
        const { up, down } = mainStageConduction(c, r.env);
        expect(up !== down, `${src} ${JSON.stringify(r.env)}`).toBe(true);
      }
    }
  });

  test('a variable called Y or X does not clash with the output or the gate', () => {
    expect(verify(compile('!(X*Y)')).ok).toBe(true);
  });
});

describe('random expressions (a seeded sample) all compile to gates that work', () => {
  function rng(seed: number) {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gen = (r: () => number, depth: number): string => {
    if (depth === 0 || r() < 0.25) return (r() < 0.25 ? '!' : '') + 'ABCD'[Math.floor(r() * 4)];
    const k = 2 + Math.floor(r() * 2);
    const parts = Array.from({ length: k }, () => gen(r, depth - 1));
    const s = `(${parts.join(r() < 0.5 ? '*' : '+')})`;
    return r() < 0.3 ? `!${s}` : s;
  };
  test('200 of them', () => {
    const r = rng(9);
    let tried = 0;
    let built = 0;
    while (built < 200 && tried < 2000) {
      tried++;
      let c;
      try {
        c = compile(gen(r, 3));
      } catch {
        continue; // too big to draw
      }
      built++;
      const v = verify(c);
      expect(v.ok && v.clean, `${c.source}: rows ${v.rows.filter((x) => !x.ok).map((x) => x.bits.join(''))}`).toBe(true);
    }
    expect(built).toBe(200);
  });
});

describe('reading a network back as an expression', () => {
  test('the pull-down reads as the expression; the pull-up as its dual over complemented signals', () => {
    const c = compile('!(A*(B+C))');
    expect(showNet(c.pdn)).toBe('A·(B + C)');
    expect(showNet(c.pun, true)).toBe('A′ + B′·C′');
  });
  test('a complemented input shows a prime', () => {
    const c = compile('A^B');
    expect(showNet(c.pdn)).toBe('(A′ + B)·(A + B′)');
  });
});

describe('widths line up with the drawn transistors', () => {
  test('the i-th width belongs to the i-th drawn transistor (same kind, same gate signal)', () => {
    for (const src of ['!(A*(B+C))', 'A^B', 'A*B', '!(A*B+C*D)']) {
      const c = compile(src);
      const g = gateCircuit(c);
      const drawn = g.transistors.map((id) => g.circuit.components.find((p) => p.id === id)!);
      const specs = transistorsOf(c.cell);
      expect(drawn.map((p) => p.type)).toEqual(specs.map((t) => (t.p ? 'pmos' : 'nmos')));
      expect(drawn.map((p) => p.label)).toEqual(gateSignals(c.cell));
      expect(widths(c.cell)).toHaveLength(specs.length);
    }
  });
});
