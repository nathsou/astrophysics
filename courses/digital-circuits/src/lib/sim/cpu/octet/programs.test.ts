import { describe, expect, test } from 'vitest';
import { assembleOrThrow, type OctetProgram } from './assembler';
import { OctetMachine } from './machine';
import { OCTET_PROGRAMS, octetProgram } from './programs';
import { Prng } from '../common/prng';
import { lfsr8 } from '../common/board';

function load(id: string, hooks: ConstructorParameters<typeof OctetMachine>[0] = {}): { m: OctetMachine; p: OctetProgram } {
  const p = assembleOrThrow(octetProgram(id).source, id);
  return { m: new OctetMachine(hooks).load(p), p };
}

describe('every program assembles and fits in RAM', () => {
  test.each(OCTET_PROGRAMS.map((p) => [p.id, p] as const))('%s', (_id, prog) => {
    const p = assembleOrThrow(prog.source, prog.id);
    expect(p.size).toBeGreaterThan(0);
    expect(p.size).toBeLessThanOrEqual(240);
    expect(p.diagnostics).toEqual([]);
  });
});

describe('blink', () => {
  test('alternates the halves of the LEDs at a steady rate', () => {
    const writes: [number, number][] = [];
    const { m } = load('blink', { hooks: { onLeds: (v) => writes.push([v, m.cycles]) } });
    while (writes.length < 5) m.step();
    expect(writes.map((w) => w[0])).toEqual([0x0f, 0xf0, 0x0f, 0xf0, 0x0f]);
    const gaps = writes.slice(1).map((w, i) => w[1] - writes[i]![1]);
    expect(new Set(gaps).size).toBe(1);
    expect(gaps[0]).toBeGreaterThan(4 * 2560);
  });
});

describe('count', () => {
  test('shows 0–255 on the LEDs and the hex display, then halts', () => {
    const leds: number[] = [];
    const { m } = load('count', { hooks: { onLeds: (v) => leds.push(v) } });
    expect(m.run(10_000_000).reason).toBe('halted');
    expect(leds).toEqual([...Array(256).keys()]);
    expect(m.board.hex).toBe(255);
  });
});

describe('multiply', () => {
  const multiply = (x: number, y: number) => {
    const { m, p } = load('multiply');
    m.memory[p.symbols.x!] = x;
    m.memory[p.symbols.y!] = y;
    expect(m.run().reason).toBe('halted');
    return { product: m.memory[p.symbols.lo!]! | (m.memory[p.symbols.hi!]! << 8), m };
  };

  test('13 × 11 = 143, shown as hi on the hex display and lo on the LEDs', () => {
    const { product, m } = multiply(13, 11);
    expect(product).toBe(143);
    expect([m.board.hex, m.board.leds]).toEqual([0x00, 0x8f]);
  });

  test('edge cases and random pairs', () => {
    const pairs: [number, number][] = [[0, 0], [0, 255], [255, 0], [1, 1], [255, 255], [200, 250], [128, 2], [2, 128]];
    const rng = new Prng(7);
    for (let i = 0; i < 100; i++) pairs.push([rng.int(0, 255), rng.int(0, 255)]);
    for (const [x, y] of pairs) expect(multiply(x, y).product, `${x} × ${y}`).toBe(x * y);
  });
});

describe('fibonacci', () => {
  test('stores the 13 Fibonacci numbers below 256', () => {
    const { m, p } = load('fibonacci');
    expect(m.run().reason).toBe('halted');
    const fib = p.symbols.fib!;
    expect([...m.memory.slice(fib, fib + 13)]).toEqual([1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]);
    expect(m.board.hex).toBe(233);
  });
});

describe('hello', () => {
  test('prints HELLO, WORLD', () => {
    const { m } = load('hello');
    expect(m.run().reason).toBe('halted');
    expect(m.board.consoleText).toBe('HELLO, WORLD\n');
  });
});

describe('sort', () => {
  const sort = (data: number[]) => {
    const { m, p } = load('sort');
    m.memory.set(data, p.symbols.data!);
    expect(m.run().reason).toBe('halted');
    return [...m.memory.slice(p.symbols.data!, p.symbols.data! + 8)];
  };

  test('sorts the built-in list', () => {
    expect(sort([42, 7, 255, 0, 128, 7, 99, 1])).toEqual([0, 1, 7, 7, 42, 99, 128, 255]);
  });

  test('sorted, reversed, equal and random lists', () => {
    const lists = [[1, 2, 3, 4, 5, 6, 7, 8], [8, 7, 6, 5, 4, 3, 2, 1], Array(8).fill(9), [255, 0, 255, 0, 255, 0, 255, 0]];
    const rng = new Prng(99);
    for (let i = 0; i < 50; i++) lists.push(Array.from({ length: 8 }, () => rng.int(0, 255)));
    for (const list of lists) expect(sort(list)).toEqual([...list].sort((a, b) => a - b));
  });
});

describe('reaction', () => {
  /** Play one round: press BTN0 `after` cycles after the LEDs light (or at a fixed cycle). */
  function play(pressAt: (go: number | undefined, cycles: number) => boolean) {
    let go: number | undefined;
    const hexWrites: number[] = [];
    const { m } = load('reaction', {
      hooks: {
        onLeds: (v) => {
          if (v === 0xff) go = m.cycles;
        },
        onHex: (v) => hexWrites.push(v),
        buttons: () => (pressAt(go, m.cycles) ? 1 : 0),
      },
    });
    while (hexWrites.length === 0 && m.cycles < 5_000_000) m.step();
    return { hex: hexWrites[0], go, m };
  }

  test('the random wait comes from the RANDOM port', () => {
    const { go } = play(() => false);
    // Wait = (256 − (first LFSR value | 0x80)) ticks of about 6,680 cycles.
    const ticks = 256 - (lfsr8(1) | 0x80);
    expect(go! / ticks).toBeGreaterThan(6600);
    expect(go! / ticks).toBeLessThan(6800);
  });

  test('shows the reaction time in ticks', () => {
    for (const ticks of [0, 1, 5, 30, 100]) {
      const { hex } = play((go, c) => go !== undefined && c >= go + ticks * 6700 + 100);
      expect(hex, `${ticks} ticks`).toBe(ticks);
    }
  });

  test('too slow shows FF', () => {
    expect(play(() => false).hex).toBe(0xff);
  });

  test('pressing early is a false start (EE)', () => {
    const { hex, go } = play((g, c) => c > 100_000 && c < 110_000);
    expect(hex).toBe(0xee);
    expect(go).toBeUndefined();
  });

  test('a second round starts after release and press', () => {
    let go: number | undefined;
    let resultAt = -1;
    const hexes: number[] = [];
    const { m } = load('reaction', {
      hooks: {
        onLeds: (v) => {
          if (v === 0xff) go = m.cycles;
        },
        onHex: (v) => {
          hexes.push(v);
          go = undefined;
          resultAt = m.cycles;
        },
        buttons: () => {
          // Press 3 ticks after each "go"; after a result, release, then press briefly to restart.
          if (go !== undefined) return m.cycles > go + 3 * 6700 + 100 ? 1 : 0;
          return resultAt >= 0 && m.cycles > resultAt + 5000 && m.cycles < resultAt + 6000 ? 1 : 0;
        },
      },
    });
    while (hexes.length < 2 && m.cycles < 20_000_000) m.step();
    expect(hexes).toEqual([3, 3]);
  });
});

describe('pong', () => {
  test('a perfect player keeps the ball in play and scores', () => {
    const { m, p } = load('pong', {
      hooks: {
        buttons: () => {
          const bx = m.memory[p.symbols.bx!]!;
          const pad = m.memory[p.symbols.pad!]!;
          const centre = pad & (pad << 1) & (pad >> 1);
          return bx > centre ? 1 : bx < centre ? 2 : 0;
        },
      },
    });
    const r = m.run(300_000);
    expect(r.reason).toBe('max-steps');
    expect(m.board.hex).toBeGreaterThan(20);
    // One ball and the paddle on the screen.
    const lit = m.board.matrix.reduce((s, row) => s + row.toString(2).split('1').length - 1, 0);
    expect(lit).toBe(4);
  });

  test('with nobody playing the ball is missed and the game stops', () => {
    const { m } = load('pong');
    expect(m.run(100_000).reason).toBe('halted');
    expect(m.board.matrixText()[7]).toMatch(/^[.#]{8}$/);
    // The ball is drawn beside the paddle on the bottom row: four pixels lit.
    expect(m.board.matrix[7]!.toString(2).replace(/0/g, '')).toBe('1111');
  });
});

describe('life', () => {
  /** Reference Life on an 8 × 8 torus; rows are bytes with bit 7 on the left. */
  function lifeStep(rows: number[]): number[] {
    const cell = (r: number, c: number) => (rows[(r + 8) % 8]! >> (7 - ((c + 8) % 8))) & 1;
    return rows.map((_, r) => {
      let row = 0;
      for (let c = 0; c < 8; c++) {
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) n += cell(r + dr, c + dc);
        if (n === 3 || (n === 2 && cell(r, c))) row |= 1 << (7 - c);
      }
      return row;
    });
  }

  function startFrom(pattern: number[]) {
    const { m, p } = load('life');
    const grid = p.symbols.grid!;
    m.memory.set([pattern[7]!, ...pattern, pattern[0]!], grid);
    return { m, gen: p.symbols.gen! };
  }

  test('fits in 240 bytes of RAM', () => {
    const p = assembleOrThrow(octetProgram('life').source);
    expect(p.size).toBeLessThanOrEqual(240);
  });

  test('matches a reference implementation, generation by generation', () => {
    const rng = new Prng(2024);
    const patterns = [
      [0x40, 0x20, 0xe0, 0, 0, 0, 0, 0], // glider
      [0, 0, 0x38, 0, 0, 0, 0, 0], // blinker
      [0x81, 0, 0, 0, 0, 0, 0, 0x81], // corners (a block across the wrap)
    ];
    for (let i = 0; i < 5; i++) patterns.push(Array.from({ length: 8 }, () => rng.int(0, 255)));
    for (const pattern of patterns) {
      const { m, gen } = startFrom(pattern);
      let expected = pattern;
      for (let g = 0; g < 12; g++) {
        expect(m.runUntil(gen, 1_000_000).reason).toBe('breakpoint');
        expected = lifeStep(expected);
        expect([...m.board.matrix], `generation ${g + 1}`).toEqual(expected);
      }
    }
  });

  test('the glider comes home after 32 generations on the torus', () => {
    const glider = [0x40, 0x20, 0xe0, 0, 0, 0, 0, 0];
    const { m, gen } = startFrom(glider);
    for (let g = 0; g < 32; g++) m.runUntil(gen, 1_000_000);
    expect([...m.board.matrix]).toEqual(glider);
  });
});
