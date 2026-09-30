import { describe, expect, test } from 'vitest';
import { OCTET_INSTRUCTIONS } from '$lib/sim/cpu/octet';
import { ROUTINES, romWords, dispatchTable, unpack } from '../../21-datapath/hardware/control-word';
import { Microprogram, describe as rtl } from './microprogram';
import { Verifier, addDec, checkDec, decModel } from './verify';

describe('the microprogram model', () => {
  test('starts as the course microprogram: same ROM words and the same dispatch table', () => {
    const mp = new Microprogram();
    expect(mp.words()).toEqual(romWords());
    expect(mp.dispatch()).toEqual(dispatchTable());
    expect(mp.length).toBe(57);
    expect(mp.problems()).toEqual([]);
  });

  test('describe() regenerates the spec’s own wording for every step of every instruction but SHL’s', () => {
    let same = 0;
    let all = 0;
    const odd: string[] = [];
    for (const r of ROUTINES) {
      if (r.name === 'FETCH' || r.name === 'DECODE' || r.name === 'Jcc') continue;
      const instr = OCTET_INSTRUCTIONS.find((i) => i.mnemonic === r.name)!;
      r.steps.forEach((s, i) => {
        all++;
        if (rtl(s.fields) === instr.steps[i]) same++;
        else odd.push(`${r.name}: ${rtl(s.fields)}  |  ${instr.steps[i]}`);
      });
    }
    // Only SHL differs: the ALU does it as A + A, and the spec writes A << 1.
    expect(odd.map((o) => o.split(':')[0]).sort()).toEqual(['SHL']);
    expect(same).toBe(all - 1);
  });

  test('a routine that runs off its end, or has END too early, is reported', () => {
    const mp = new Microprogram();
    const i = mp.addRoutine('X');
    mp.setField(i, 0, 'end', 0);
    expect(mp.problems().join(' ')).toMatch(/runs on/);
    mp.addStep(i);
    mp.setField(i, 0, 'end', 1);
    expect(mp.problems().join(' ')).toMatch(/never run/);
  });

  test('it refuses to overflow the 64-word ROM', () => {
    const mp = new Microprogram();
    const i = mp.addRoutine('BIG');
    for (let k = 0; k < 10; k++) mp.addStep(i);
    expect(() => mp.words()).toThrow(/ROM holds 64/);
  });
});

describe('the verifier', () => {
  const v = new Verifier();

  test('the course microprogram agrees with the interpreter', () => {
    expect(v.load(new Microprogram())).toBeUndefined();
    const r = v.regression(8);
    expect(r.failure).toBeUndefined();
    expect(r.ok).toBe(true);
  });

  test('a broken microprogram is caught, and says where', () => {
    const mp = new Microprogram();
    const add = mp.routines.findIndex((r) => r.name === 'ADD');
    mp.setField(add, 2, 'ldFlags', 0); // ADD forgets to set the flags
    v.load(mp);
    const r = v.regression(10);
    expect(r.ok).toBe(false);
    expect(r.failure).toMatch(/flag|R\d|pc/);
    // Putting it back repairs the machine.
    v.load(new Microprogram());
    expect(v.regression(4).ok).toBe(true);
  });

  test('DEC is missing at first, and the reference solution gives Octet a DEC in microcode alone', () => {
    v.load(new Microprogram());
    const before = checkDec(v);
    expect(before.ok).toBe(false);
    const mp = new Microprogram();
    addDec(mp);
    expect(mp.problems()).toEqual([]);
    expect(mp.length).toBe(59);
    expect(v.load(mp)).toBeUndefined();
    const after = checkDec(v);
    expect(after.failures).toEqual([]);
    expect(after.tried).toBe(18);
    // The rest of the machine is unharmed.
    expect(v.regression(6).ok).toBe(true);
    v.load(new Microprogram());
  });

  test('the DEC model has the flags of SUB Rd, 1', () => {
    expect(decModel(0)).toEqual({ r: 255, z: false, c: true, n: true, v: false });
    expect(decModel(1).z).toBe(true);
    expect(decModel(0x80).v).toBe(true);
  });

  test('the unpacked words are what the routines say', () => {
    expect(unpack(romWords()[0]!).drive).toBe(3);
  });
});
