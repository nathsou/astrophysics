import { describe, expect, test } from 'vitest';
import { assembleSource, checkAsm, octetRegister, rv32Register, runOnce, runTest, type AsmInput } from './run';

const mul: AsmInput = {
  id: 'mul',
  isa: 'octet',
  tests: [
    { name: '3 × 4', setup: { mem: { x: 3, y: 4 } }, expect: { mem: { result: 12 }, regs: { R0: 12 } } },
    { name: '0 × 9', setup: { mem: { x: 0, y: 9 } }, expect: { mem: { result: 0 } } },
  ],
};
const good = `
        LD   R0, [x]
        LD   R1, [y]
        LDI  R2, 0
loop:   ADD  R2, R0
        LDI  R3, 1
        SUB  R1, R3
        JNZ  loop
        ST   [result], R2
        MOV  R0, R2
        HLT
x:      .byte 0
y:      .byte 0
result: .byte 0
`;

describe('octet exercises', () => {
  test('register names', () => {
    expect(octetRegister('r2')).toBe(2);
    expect(() => octetRegister('R7')).toThrow();
    expect(rv32Register('a0')).toBe(10);
    expect(() => rv32Register('q1')).toThrow();
  });
  test('assembly errors carry line and column', () => {
    const r = assembleSource('octet', 'LDI R0, 1\n  BOGUS R1\n');
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0]).toMatchObject({ line: 2, severity: 'error' });
    expect(r.diagnostics[0]!.column).toBeGreaterThan(0);
  });
  test('a program that passes its tests (3 × 4 by repeated addition; 0 × 9 loops for a long time, so it fails)', () => {
    const r = checkAsm(mul, good);
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(r.results[0]!.failures).toEqual([]);
    expect(r.results[0]!.pass).toBe(true);
    // 0 × 9 gives 9 × 0 = 0 here only if the loop runs y times: it runs 9 times, adding x = 0.
    expect(r.results[1]!.pass).toBe(true);
    expect(r.pass).toBe(true);
  });
  test('wrong results are explained', () => {
    const r = checkAsm(mul, good.replace('ADD  R2, R0', 'ADD  R2, R1'));
    expect(r.pass).toBe(false);
    expect(r.results[0]!.failures.join(' ')).toMatch(/expected 12/);
  });
  test('an endless loop is reported', () => {
    const r = checkAsm({ ...mul, maxSteps: 500 }, 'loop: JMP loop\nx: .byte 0\ny: .byte 0\nresult: .byte 0');
    expect(r.results[0]!.failures[0]).toMatch(/did not stop within 500/);
  });
  test('size and cycle limits', () => {
    const r = checkAsm({ ...mul, maxBytes: 5 }, good);
    expect(r.violations[0]).toMatch(/bytes; the limit is 5/);
    expect(r.pass).toBe(false);
    const c = checkAsm({ ...mul, maxCycles: 10 }, good);
    expect(c.results[0]!.failures.join()).toMatch(/clock cycles/);
  });
  test('I/O expectations: LEDs and console', () => {
    const src = 'LDI R0, 0x55\nST [LEDS], R0\nLDI R1, 72\nST [CONSOLE], R1\nLDI R1, 105\nST [CONSOLE], R1\nHLT';
    const r = checkAsm({ id: 'io', tests: [{ expect: { leds: 0x55, console: 'Hi' } }, { expect: { leds: 0, console: 'no' } }] }, src);
    expect(r.results[0]!.pass).toBe(true);
    expect(r.results[1]!.failures).toHaveLength(2);
  });
  test('inputs reach the program', () => {
    const src = 'LD R0, [SWITCHES]\nST [LEDS], R0\nHLT';
    expect(checkAsm({ id: 'sw', tests: [{ setup: { switches: 0xa5 }, expect: { leds: 0xa5 } }] }, src).pass).toBe(true);
  });
  test('runOnce for the panel', () => {
    const a = assembleSource('octet', 'LDI R1, 7\nST [LEDS], R1\nHLT');
    const v = runOnce('octet', a.program!);
    expect(v).toMatchObject({ reason: 'halted', leds: 7 });
    expect(v.regs[1]).toEqual({ name: 'R1', value: 7 });
  });
});

describe('rv32i exercises', () => {
  const src = `
    _start: li a0, 6
            li a1, 7
            li a2, 0
    loop:   add a2, a2, a0
            addi a1, a1, -1
            bnez a1, loop
            ebreak
  `;
  test('registers after a run', () => {
    const a = assembleSource('rv32i', src);
    expect(a.ok, JSON.stringify(a.diagnostics)).toBe(true);
    const r = runTest('rv32i', a.program!, { expect: { regs: { a2: 42 } } });
    expect(r.failures).toEqual([]);
    expect(r.pass).toBe(true);
    expect(runTest('rv32i', a.program!, { expect: { regs: { a2: 41 } } }).failures[0]).toMatch(/a2 is 42/);
  });
  test('a crash is reported', () => {
    const a = assembleSource('rv32i', 'lw a0, 1(zero)\nebreak');
    const r = runTest('rv32i', a.program!, { expect: {} });
    expect(r.pass).toBe(false);
    expect(r.failures[0]).toMatch(/crashed/);
  });
  test('runOnce', () => {
    const a = assembleSource('rv32i', src);
    expect(runOnce('rv32i', a.program!).reason).toBe('halted');
  });
});
