import { describe, expect, test } from 'vitest';
import { OCTET_PROGRAMS } from '$lib/sim/cpu/octet';
import { OctetComputer } from './computer';
import { CHAPTER_PROGRAMS, programById } from './programs';

const run = (id: string, setup?: (c: OctetComputer) => void) => {
  const c = new OctetComputer(programById(id).source);
  expect(c.diagnostics, id).toEqual([]);
  setup?.(c);
  return c;
};

describe('the chapter programs assemble without a warning', () => {
  test.each(CHAPTER_PROGRAMS.map((p) => [p.id, p.source] as const))('%s', (id, source) => {
    const c = new OctetComputer(source);
    expect(c.diagnostics, id).toEqual([]);
    expect(c.program.size).toBeLessThanOrEqual(240);
  });
  test('every course program can be looked up', () => {
    for (const p of OCTET_PROGRAMS) expect(programById(p.id).source).toBe(p.source);
  });
});

describe('sum', () => {
  test('is 15 on the LEDs after 22 instructions and 110 cycles', () => {
    const c = run('sum');
    expect(c.runToHalt()).toBe('halted');
    expect(c.board.leds).toBe(15);
    expect([c.machine.steps, c.machine.cycles]).toEqual([20, 110]);
    expect(c.program.size).toBe(13);
    expect(c.program.symbols.loop).toBe(6);
  });
});

describe('compare', () => {
  test('0xFF is not below 3 unsigned but is below 3 signed', () => {
    const c = run('compare');
    c.runToHalt();
    expect(c.board.leds).toBe(0b10);
  });
  test('the same program with 2 instead of 0xFF says "less" both ways', () => {
    const c = new OctetComputer(programById('compare').source.replace('LDI  R0, 0xFF', 'LDI  R0, 2'));
    c.runToHalt();
    expect(c.board.leds).toBe(0b11);
  });
});

describe('stack', () => {
  test('quad(5) = 20, the return addresses were on the stack at 0xEE and 0xEF, and the stack is empty at the end', () => {
    const c = run('stack');
    const seen: { sp: number; ee: number; ef: number }[] = [];
    while (!c.halted) {
      c.stepInstruction();
      seen.push({ sp: c.machine.sp, ee: c.machine.memory[0xee]!, ef: c.machine.memory[0xef]! });
    }
    expect(c.board.leds).toBe(20);
    expect(c.machine.sp).toBe(0xf0);
    // Deepest: quad called from 0x02, then double called from inside quad.
    expect(Math.min(...seen.map((s) => s.sp))).toBe(0xee);
    expect(c.program.symbols.quad).toBe(0x07);
    expect(c.machine.memory[0xef]).toBe(0x04); // return address of the first CALL (still there: popping does not erase)
    // Quad's two calls both leave their return address at 0xEE: 9 after the first, 11 (0x0B) after the second.
    expect(seen.map((x) => x.ee).filter((v, i, a) => v && v !== a[i - 1])).toEqual([9, 11]);
    expect(c.machine.memory[0xee]).toBe(0x0b);
  });
});

describe('print-decimal', () => {
  const print = (n: number) => {
    const c = new OctetComputer(programById('print-decimal').source.replace('LDI  R0, 137', `LDI  R0, ${n}`));
    expect(c.runToHalt()).toBe('halted');
    return c.board.consoleText;
  };
  test('137 prints 137', () => expect(print(137)).toBe('137\n'));
  test('every byte prints as its decimal digits, with no leading zeros', () => {
    for (let n = 0; n < 256; n++) expect(print(n), String(n)).toBe(`${n}\n`);
  });
});

describe('echo', () => {
  test('polls until a key is typed, then shows and returns it', () => {
    const c = run('echo');
    c.run(500);
    expect(c.board.leds).toBe(0);
    c.board.type('A');
    c.run(500);
    expect(c.board.leds).toBe(0x41);
    expect(c.board.consoleText).toBe('A');
    expect(c.halted).toBe(false);
  });
});
