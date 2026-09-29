import { describe, expect, test } from 'vitest';
import { Prng } from '../common/prng';
import { lfsr32 } from '../common/board';
import { assembleOrThrow as assembleOctet } from '../octet/assembler';
import { OctetMachine } from '../octet/machine';
import { octetProgram } from '../octet/programs';
import { assembleOrThrow, type Rv32Program } from './assembler';
import { Rv32Machine, type Rv32MachineOptions } from './machine';
import { RV32_PROGRAMS, rv32Program } from './programs';
import type { Rv32TrapCause } from './board';

function load(id: string, options: Rv32MachineOptions = {}): { m: Rv32Machine; p: Rv32Program } {
  const p = assembleOrThrow(rv32Program(id).source, id);
  return { m: new Rv32Machine(options).load(p), p };
}

/** Run to the program's `ebreak`. */
function finish(m: Rv32Machine, maxSteps = 10_000_000): void {
  expect(m.run(maxSteps).reason).toBe('trap');
  expect(m.trap?.cause satisfies Rv32TrapCause | undefined).toBe('breakpoint');
}

describe('every program assembles cleanly and fits in RAM', () => {
  test.each(RV32_PROGRAMS.map((p) => [p.id, p] as const))('%s', (_id, prog) => {
    const p = assembleOrThrow(prog.source, prog.id);
    expect(p.diagnostics).toEqual([]);
    expect(p.size).toBeGreaterThan(0);
    expect(p.size).toBeLessThanOrEqual(2048); // programs and data stay below 2 KiB, so labels reach from zero
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
    expect(gaps[0]).toBeGreaterThan(10000);
    expect(gaps[0]).toBeLessThan(11000);
  });
});

describe('count', () => {
  test('shows 0–255 on the LEDs and the hex display, then stops', () => {
    const leds: number[] = [];
    const { m } = load('count', { hooks: { onLeds: (v) => leds.push(v) } });
    finish(m);
    expect(leds).toEqual([...Array(256).keys()]);
    expect(m.board.hex).toBe(255);
  });
});

describe('multiply', () => {
  const multiply = (x: number, y: number) => {
    const { m, p } = load('multiply');
    m.memory[p.symbols.x!] = x;
    m.memory[p.symbols.y!] = y;
    finish(m);
    return { product: m.peekWord(p.symbols.product!)!, m };
  };

  test('13 × 11 = 143, on the hex display and (low byte) the LEDs', () => {
    const { product, m } = multiply(13, 11);
    expect(product).toBe(143);
    expect([m.board.hex, m.board.leds]).toEqual([143, 143]);
  });

  test('edge cases and random pairs (products up to 16 bits)', () => {
    const pairs: [number, number][] = [[0, 0], [0, 255], [255, 0], [1, 1], [255, 255], [200, 250], [128, 2], [2, 128]];
    const rng = new Prng(7);
    for (let i = 0; i < 100; i++) pairs.push([rng.int(0, 255), rng.int(0, 255)]);
    for (const [x, y] of pairs) {
      const { product, m } = multiply(x, y);
      expect(product, `${x} × ${y}`).toBe(x * y);
      expect(m.board.hex).toBe(x * y);
    }
  });

  test('it copes with operands wider than a byte too', () => {
    const { m, p } = load('multiply');
    m.write(p.symbols.x!, 1000);
    m.write(p.symbols.y!, 65);
    finish(m);
    expect(m.peekWord(p.symbols.product!)).toBe(65000);
  });
});

describe('fibonacci', () => {
  test('stores the 13 Fibonacci numbers below 256', () => {
    const { m, p } = load('fibonacci');
    finish(m);
    const fib = p.symbols.fib!;
    const table = Array.from({ length: 13 }, (_, i) => m.peekWord(fib + 4 * i));
    expect(table).toEqual([1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]);
    expect(m.peekWord(fib + 52)).toBe(0); // nothing written past the table
    expect(m.board.hex).toBe(233);
  });
});

describe('hello', () => {
  test('prints HELLO, WORLD', () => {
    const { m } = load('hello');
    finish(m);
    expect(m.board.consoleText).toBe('HELLO, WORLD\n');
  });
});

describe('sort', () => {
  const sort = (data: number[]) => {
    const { m, p } = load('sort');
    m.memory.set(data, p.symbols.data!);
    finish(m);
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
  const TICK = 8192;

  /** Play one round: press BTN0 when `pressAt(go, cycles)` says so. */
  function play(pressAt: (go: number | undefined, cycles: number) => boolean, random?: () => number) {
    let go: number | undefined;
    const hexWrites: number[] = [];
    const { m } = load('reaction', {
      hooks: {
        onLeds: (v) => {
          if (v === 0xff) go = m.cycles;
        },
        onHex: (v) => hexWrites.push(v),
        buttons: () => (pressAt(go, m.cycles) ? 1 : 0),
        random,
      },
    });
    while (hexWrites.length === 0 && m.cycles < 5_000_000) m.step();
    return { hex: hexWrites[0], go, m };
  }

  test('the random wait comes from the RANDOM port: 1 to 128 ticks', () => {
    const { go } = play(() => false);
    const ticks = (lfsr32(1) & 0x7f) + 1;
    expect(go! / TICK).toBeGreaterThan(ticks);
    expect(go! / TICK).toBeLessThan(ticks + 0.02);
  });

  test('shows the reaction time in ticks', () => {
    for (const ticks of [0, 1, 5, 30, 100]) {
      const { hex } = play((go, c) => go !== undefined && c >= go + ticks * TICK + 100);
      expect(hex, `${ticks} ticks`).toBe(ticks);
    }
  });

  test('too slow shows FF', () => {
    expect(play(() => false).hex).toBe(0xff);
  });

  test('pressing early is a false start (EE)', () => {
    // The wait is 128 ticks (about a million cycles) with this "random" value; press after 100,000.
    const { hex, go } = play((g, c) => c > 100_000 && c < 110_000, () => 0x7f);
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
          if (go !== undefined) return m.cycles > go + 3 * TICK + 100 ? 1 : 0;
          return resultAt >= 0 && m.cycles > resultAt + 5000 && m.cycles < resultAt + 6000 ? 1 : 0;
        },
      },
    });
    while (hexes.length < 2 && m.cycles < 20_000_000) m.step();
    expect(hexes).toEqual([3, 3]);
  });
});

describe('pong', () => {
  // s0 = ball column mask, s4 = paddle mask (x8 and x20).
  const perfectPlayer = (m: () => Rv32Machine) => () => {
    const bx = m().reg(8);
    const pad = m().reg(20);
    const centre = pad & (pad << 1) & (pad >> 1);
    return bx > centre ? 1 : bx < centre ? 2 : 0;
  };

  test('a perfect player keeps the ball in play and scores', () => {
    let mm!: Rv32Machine;
    const { m } = load('pong', { hooks: { buttons: perfectPlayer(() => mm) } });
    mm = m;
    expect(m.run(1_000_000).reason).toBe('max-steps');
    expect(m.board.hex).toBeGreaterThan(20);
    const lit = m.board.matrix.reduce((s, row) => s + row.toString(2).split('1').length - 1, 0);
    expect(lit).toBe(4); // one ball and a paddle of three
  });

  test('with nobody playing the ball is missed and the game stops', () => {
    const { m } = load('pong');
    finish(m, 200_000);
    // The ball is drawn beside the paddle on the bottom row: four pixels lit.
    expect(m.board.matrix[7]!.toString(2).replace(/0/g, '')).toBe('1111');
  });

  test('frame by frame the same picture as the Octet program, whatever the buttons do', () => {
    // Play Octet's Pong with three kinds of player, record the buttons frame by frame, and give
    // RV32I's Pong the same presses: every frame must come out the same.
    const players: Record<string, (rng: Prng, bx: number, pad: number) => number> = {
      perfect: (_rng, bx, pad) => {
        const centre = pad & (pad << 1) & (pad >> 1);
        return bx > centre ? 1 : bx < centre ? 2 : 0;
      },
      clumsy: (rng, bx, pad) => {
        const centre = pad & (pad << 1) & (pad >> 1);
        return rng.chance(0.15) ? rng.int(0, 3) : bx > centre ? 1 : bx < centre ? 2 : 0;
      },
      random: (rng) => rng.pick([0, 0, 1, 2, 1, 3]),
    };
    for (const [name, player] of Object.entries(players)) {
      const rng = new Prng(31);
      const presses: number[] = [];
      const frames: string[] = [];
      const p = assembleOctet(octetProgram('pong').source);
      const om: OctetMachine = new OctetMachine({
        hooks: {
          buttons: () => {
            const v = player(rng, om.memory[p.symbols.bx!]!, om.memory[p.symbols.pad!]!);
            presses.push(v);
            return v;
          },
        },
      }).load(p);
      while (frames.length < 120 && om.runUntil(p.symbols.frame!, 1_000_000).reason === 'breakpoint') frames.push(om.board.matrixText().join('/') + ` ${om.board.hex}`);

      let reads = 0;
      const rp = assembleOrThrow(rv32Program('pong').source);
      const rm = new Rv32Machine({ hooks: { buttons: () => presses[reads++] ?? 0 } }).load(rp);
      const rframes: string[] = [];
      rm.runUntil(rp.symbols.frame!, 1000); // the set-up code runs first: Octet's Pong starts at its first frame
      while (rframes.length < frames.length && rm.runUntil(rp.symbols.frame!, 1_000_000).reason === 'breakpoint') rframes.push(rm.board.matrixText().join('/') + ` ${rm.board.hex}`);
      expect(rframes.length, name).toBe(frames.length);
      expect(rframes, name).toEqual(frames);
      if (name === 'perfect') expect(frames.length).toBe(120);
    }
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
    m.memory.set(pattern, p.symbols.grid!);
    return { m, gen: p.symbols.gen!, grid: p.symbols.grid! };
  }

  test('matches a reference implementation, generation by generation', () => {
    const rng = new Prng(2024);
    const patterns = [
      [0x40, 0x20, 0xe0, 0, 0, 0, 0, 0], // glider
      [0, 0, 0x38, 0, 0, 0, 0, 0], // blinker
      [0x81, 0, 0, 0, 0, 0, 0, 0x81], // corners (a block across the wrap)
      [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], // everything dies
      [0, 0, 0, 0, 0, 0, 0, 0],
    ];
    for (let i = 0; i < 12; i++) patterns.push(Array.from({ length: 8 }, () => rng.int(0, 255)));
    for (const pattern of patterns) {
      const { m, gen } = startFrom(pattern);
      let expected = pattern;
      for (let g = 0; g < 12; g++) {
        expect(m.runUntil(gen, 1_000_000).reason).toBe('breakpoint');
        expected = lifeStep(expected);
        expect([...m.board.matrix], `generation ${g + 1} from ${pattern.join(',')}`).toEqual(expected);
      }
    }
  });

  test('every 8 × 8 row of a cell pattern: exhaustive over one row with the rows around it', () => {
    // Every byte as the middle row, with two fixed neighbours, checks all 8 columns against all neighbourhoods.
    const { m, gen, grid } = startFrom([0, 0, 0, 0, 0, 0, 0, 0]);
    const rng = new Prng(5);
    for (let v = 0; v < 256; v++) {
      const pattern = [rng.int(0, 255), v, rng.int(0, 255), 0, 0, 0, 0, rng.int(0, 255)];
      m.reset();
      m.memory.set(pattern, grid);
      expect(m.runUntil(gen, 1_000_000).reason).toBe('breakpoint');
      expect([...m.board.matrix]).toEqual(lifeStep(pattern));
    }
  });

  test('the glider comes home after 32 generations on the torus', () => {
    const glider = [0x40, 0x20, 0xe0, 0, 0, 0, 0, 0];
    const { m, gen } = startFrom(glider);
    for (let g = 0; g < 32; g++) m.runUntil(gen, 1_000_000);
    expect([...m.board.matrix]).toEqual(glider);
  });

  test('the same generations as the Octet program', () => {
    const rng = new Prng(8);
    const pattern = Array.from({ length: 8 }, () => rng.int(0, 255));
    const { m, gen } = startFrom(pattern);
    const op = assembleOctet(octetProgram('life').source);
    const om = new OctetMachine().load(op);
    om.memory.set([pattern[7]!, ...pattern, pattern[0]!], op.symbols.grid!);
    for (let g = 0; g < 10; g++) {
      m.runUntil(gen, 1_000_000);
      om.runUntil(op.symbols.gen!, 1_000_000);
      expect([...m.board.matrix], `generation ${g + 1}`).toEqual([...om.board.matrix]);
    }
  });
});

describe('the two CPUs on the same tasks', () => {
  test('hello and fibonacci agree', () => {
    const om = new OctetMachine().load(assembleOctet(octetProgram('hello').source));
    om.run();
    const { m } = load('hello');
    finish(m);
    expect(m.board.consoleText).toBe(om.board.consoleText);

    const op = assembleOctet(octetProgram('fibonacci').source);
    const of = new OctetMachine().load(op);
    of.run();
    const fr = load('fibonacci');
    finish(fr.m);
    const octetFib = [...of.memory.slice(op.symbols.fib!, op.symbols.fib! + 13)];
    const rvFib = Array.from({ length: 13 }, (_, i) => fr.m.peekWord(fr.p.symbols.fib! + 4 * i));
    expect(rvFib).toEqual(octetFib);
  });
});
