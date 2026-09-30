import { describe, expect, test } from 'vitest';
import { BIT_COUNT, ROW_BITS, ROW_COUNT, blankBits, usercodeText, type Level } from '../devices/vcpld32-arch';
import { VCpld32 } from '../devices/vcpld32';
import { mulberry32 } from '../twolevel/random';
import { bcdDisplayDesign, counter4Design, trafficDesign } from './designs';
import { fitCpld } from './fit';
import {
  BSR_LENGTH,
  CpldJtag,
  ERASE_CYCLES,
  IDCODE_VALUE,
  INSTRUCTIONS,
  IR_LENGTH,
  JtagBoard,
  JtagHost,
  PROGRAM_CYCLES,
  TAP_CODE,
  TAP_STATES,
  bitsToNumber,
  decodeIrCapture,
  describeBoundaryCell,
  instructionName,
  nextTapState,
  numberToBits,
  tapPath,
  type TapState,
} from './jtag';

// -- The standard's state diagram, written out independently of the implementation --------------------
//                                   TMS = 0                TMS = 1
const DIAGRAM: [TapState, TapState, TapState][] = [
  ['Test-Logic-Reset', 'Run-Test/Idle', 'Test-Logic-Reset'],
  ['Run-Test/Idle', 'Run-Test/Idle', 'Select-DR-Scan'],
  ['Select-DR-Scan', 'Capture-DR', 'Select-IR-Scan'],
  ['Capture-DR', 'Shift-DR', 'Exit1-DR'],
  ['Shift-DR', 'Shift-DR', 'Exit1-DR'],
  ['Exit1-DR', 'Pause-DR', 'Update-DR'],
  ['Pause-DR', 'Pause-DR', 'Exit2-DR'],
  ['Exit2-DR', 'Shift-DR', 'Update-DR'],
  ['Update-DR', 'Run-Test/Idle', 'Select-DR-Scan'],
  ['Select-IR-Scan', 'Capture-IR', 'Test-Logic-Reset'],
  ['Capture-IR', 'Shift-IR', 'Exit1-IR'],
  ['Shift-IR', 'Shift-IR', 'Exit1-IR'],
  ['Exit1-IR', 'Pause-IR', 'Update-IR'],
  ['Pause-IR', 'Pause-IR', 'Exit2-IR'],
  ['Exit2-IR', 'Shift-IR', 'Update-IR'],
  ['Update-IR', 'Run-Test/Idle', 'Select-DR-Scan'],
];

describe('the TAP controller state machine', () => {
  test.each(DIAGRAM)('%s: TMS=0 → %s, TMS=1 → %s', (state, on0, on1) => {
    expect(nextTapState(state, 0)).toBe(on0);
    expect(nextTapState(state, 1)).toBe(on1);
  });

  test('exactly 16 states with distinct codes, all covered by the table', () => {
    expect(TAP_STATES).toHaveLength(16);
    expect(new Set(TAP_STATES).size).toBe(16);
    expect(new Set(Object.values(TAP_CODE)).size).toBe(16);
    expect(DIAGRAM.map((r) => r[0]).sort()).toEqual([...TAP_STATES].sort());
    expect(TAP_CODE['Test-Logic-Reset']).toBe(0xf);
    expect(TAP_CODE['Shift-DR']).toBe(0x2);
    expect(TAP_CODE['Shift-IR']).toBe(0xa);
  });

  test('five cycles with TMS = 1 reach Test-Logic-Reset from any state', () => {
    for (const start of TAP_STATES) {
      let s = start;
      for (let i = 0; i < 5; i++) s = nextTapState(s, 1);
      expect(s, `from ${start}`).toBe('Test-Logic-Reset');
      // ... and never in fewer than that from the worst case (Run-Test/Idle needs 3 ones to reach it via Select-DR, Select-IR, TLR).
    }
    // The port itself, driven by the host from an arbitrary state, does the same.
    for (const start of TAP_STATES) {
      const chip = new CpldJtag();
      const host = new JtagHost(chip);
      for (const tms of tapPath('Test-Logic-Reset', start)) host.clock(tms);
      expect(chip.state).toBe(start);
      for (let i = 0; i < 5; i++) host.clock(1);
      expect(chip.state).toBe('Test-Logic-Reset');
      expect(chip.ir).toBe(INSTRUCTIONS.IDCODE);
    }
  });

  test('tapPath finds shortest sequences', () => {
    expect(tapPath('Run-Test/Idle', 'Shift-DR')).toEqual([1, 0, 0]);
    expect(tapPath('Run-Test/Idle', 'Shift-IR')).toEqual([1, 1, 0, 0]);
    expect(tapPath('Shift-DR', 'Run-Test/Idle')).toEqual([1, 1, 0]);
    expect(tapPath('Pause-DR', 'Shift-DR')).toEqual([1, 0]);
    expect(tapPath('Shift-IR', 'Shift-IR')).toEqual([]);
    for (const a of TAP_STATES)
      for (const b of TAP_STATES) {
        let s = a;
        for (const tms of tapPath(a, b)) s = nextTapState(s, tms);
        expect(s).toBe(b);
      }
  });
});

describe('identification and bypass', () => {
  test('IDCODE is read after reset: 32 bits, mandatory LSB 1', () => {
    const chip = new CpldJtag();
    const host = new JtagHost(chip);
    const id = host.readIdcode();
    expect(id).toBe(IDCODE_VALUE);
    expect(id).toBe(0x1c0321ff);
    expect(id & 1).toBe(1);
    expect((id >>> 28) & 0xf).toBe(1); // version
    expect((id >>> 12) & 0xffff).toBe(0xc032); // part
    expect((id >>> 1) & 0x7ff).toBe(0x0ff); // manufacturer
  });

  test('the instruction register captures 01 in its two low bits, plus status', () => {
    const chip = new CpldJtag();
    const host = new JtagHost(chip);
    host.reset();
    const cap = host.shiftIr(INSTRUCTIONS.BYPASS);
    expect(cap & 3).toBe(1);
    expect(cap).toBe(0x01);
    expect(decodeIrCapture(cap)).toEqual({ valid: true, isc: false, busy: false, error: false });
    expect(IR_LENGTH).toBe(8);
    // What was loaded is captured next time.
    expect(chip.ir).toBe(INSTRUCTIONS.BYPASS);
  });

  test('the TDO bit stream of an instruction-register scan: LSB first, the captured 1 then 0', () => {
    const chip = new CpldJtag();
    const host = new JtagHost(chip);
    host.reset();
    host.clearTrace();
    host.shiftIr(INSTRUCTIONS.IDCODE);
    const shifted = host.trace.filter((c) => c.state === 'Shift-IR').map((c) => c.tdo);
    expect(shifted).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    const states = host.trace.map((c) => c.state);
    expect(states).toEqual([
      'Run-Test/Idle',
      'Select-DR-Scan',
      'Select-IR-Scan',
      'Capture-IR',
      ...Array(8).fill('Shift-IR'),
      'Exit1-IR',
      'Update-IR',
    ]);
  });

  test('BYPASS is a single bit: TDO is TDI one cycle later', () => {
    const chip = new CpldJtag();
    const host = new JtagHost(chip);
    host.reset();
    host.loadInstruction('BYPASS');
    expect(chip.ir).toBe(0xff);
    const pattern = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1];
    const out = host.shiftDr(pattern);
    expect(Array.from(out)).toEqual([0, ...pattern.slice(0, -1)]);
    // Unassigned instruction codes also select BYPASS.
    host.shiftIr(0x5a);
    expect(instructionName(0x5a)).toBe('BYPASS (unassigned)');
    expect(Array.from(host.shiftDr(pattern))).toEqual([0, ...pattern.slice(0, -1)]);
  });

  test('a scan may be paused: Exit1 → Pause → Exit2 → Shift gives the same bits, and Update comes only at the end', () => {
    const chip = new CpldJtag();
    const host = new JtagHost(chip);
    host.reset();
    host.goto('Shift-DR');
    const out: number[] = [];
    for (let i = 0; i < 9; i++) out.push(host.clock(0)!);
    // Leave Shift-DR without updating: 1 → Exit1-DR (this cycle still shifts the tenth bit), 0 → Pause-DR,
    // wait, 1 → Exit2-DR, 0 → Shift-DR.
    out.push(host.clock(1)!);
    expect(chip.state).toBe('Exit1-DR');
    host.clock(0);
    expect(chip.state).toBe('Pause-DR');
    for (let i = 0; i < 5; i++) expect(host.clock(0)).toBeNull();
    host.clock(1);
    expect(chip.state).toBe('Exit2-DR');
    host.clock(0);
    expect(chip.state).toBe('Shift-DR');
    for (let i = 0; i < 22; i++) out.push(host.clock(i === 21 ? 1 : 0)!);
    expect(bitsToNumber(out)).toBe(IDCODE_VALUE);
    host.clock(1); // Update-DR
    expect(chip.state).toBe('Update-DR');
    host.clock(0);
    expect(chip.state).toBe('Run-Test/Idle');
  });

  test('TDO is high-impedance outside the shift states', () => {
    const chip = new CpldJtag();
    const host = new JtagHost(chip);
    host.reset();
    host.loadInstruction('IDCODE');
    host.shiftDr(new Uint8Array(32));
    for (const c of host.trace) {
      if (c.state === 'Shift-DR' || c.state === 'Shift-IR') expect(c.tdo).not.toBeNull();
      else expect(c.tdo).toBeNull();
    }
  });

  test('USERCODE reads the code from the last row', () => {
    const fit = fitCpld(counter4Design());
    const chip = new CpldJtag(fit.device());
    const host = new JtagHost(chip);
    host.reset();
    expect(usercodeText(host.readUsercode())).toBe('CNT4');
  });

  test('the trace records every cycle consistently', () => {
    const chip = new CpldJtag();
    const host = new JtagHost(chip);
    host.readIdcode();
    expect(host.trace).toHaveLength(host.cycles);
    host.trace.forEach((c, i) => {
      expect(c.cycle).toBe(i);
      expect(c.next).toBe(nextTapState(c.state, c.tms));
      if (i > 0) expect(c.state).toBe(host.trace[i - 1]!.next);
    });
    expect(host.trace[0]!.instruction).toBe('IDCODE');
  });
});

describe('programming through the TAP', () => {
  const design = () => fitCpld(bcdDisplayDesign());

  test('program, verify and run: the bits arrive intact', () => {
    const fit = design();
    const chip = new CpldJtag();
    const host = new JtagHost(chip);
    expect(chip.device.isBlank).toBe(true);
    const res = host.programDevice(fit.bits);
    expect(res.ok).toBe(true);
    expect(res.mismatches).toEqual([]);
    expect(res.error).toBe(false);
    expect(res.rowsProgrammed).toBeGreaterThan(5);
    expect(res.rowsProgrammed).toBeLessThan(ROW_COUNT);
    expect(Array.from(chip.device.bits)).toEqual(Array.from(fit.bits));
    // Read it all back through the port too.
    host.reset();
    host.enableIsc();
    expect(Array.from(host.readConfiguration())).toEqual(Array.from(fit.bits));
    host.disableIsc();
    // The programmed device counts.
    const dev = chip.device;
    const counts: number[] = [];
    const pins = new Array<number>(32).fill(0);
    pins[fit.pinOf.EN!] = 1;
    for (let i = 0; i < 12; i++) {
      const s = dev.clock({ pins });
      counts.push(fit.outputs.filter((o) => o.name.startsWith('Q')).reduce((v, o) => v + (s.mc[o.macrocell]! << Number(o.name[1])), 0));
    }
    expect(counts).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2]);
  });

  test('every design programs and verifies, including a full-density random configuration', () => {
    const rng = mulberry32(7);
    const random = blankBits();
    for (let i = 0; i < BIT_COUNT; i++) random[i] = rng.chance(0.5) ? 1 : 0;
    for (const bits of [fitCpld(counter4Design()).bits, fitCpld(trafficDesign()).bits, random]) {
      const chip = new CpldJtag();
      const host = new JtagHost(chip);
      const res = host.programDevice(bits);
      expect(res.ok).toBe(true);
      expect(res.rowsProgrammed).toBeLessThanOrEqual(ROW_COUNT);
      expect(Array.from(chip.device.bits)).toEqual(Array.from(bits));
    }
  });

  test('reprogramming a used device erases first', () => {
    const chip = new CpldJtag(design().device());
    const host = new JtagHost(chip);
    const other = fitCpld(trafficDesign()).bits;
    const res = host.programDevice(other);
    expect(res.ok).toBe(true);
    expect(Array.from(chip.device.bits)).toEqual(Array.from(other));
  });

  test('programming without erasing only sets bits, and verify notices', () => {
    const a = fitCpld(counter4Design()).bits;
    const b = fitCpld(trafficDesign()).bits;
    const chip = new CpldJtag(new VCpld32(a));
    const host = new JtagHost(chip);
    host.reset();
    host.enableIsc();
    host.loadInstruction('ISC_PROGRAM');
    host.programRows(b);
    const v = host.verify(b);
    expect(v.ok).toBe(false);
    expect(v.mismatches.length).toBeGreaterThan(0);
    // The device holds a OR b.
    for (let i = 0; i < BIT_COUNT; i++) expect(chip.device.bits[i]).toBe(a[i]! | b[i]!);
  });

  test('ISC_PROGRAM outside programming mode is refused and sets the error status', () => {
    const chip = new CpldJtag();
    const host = new JtagHost(chip);
    host.reset();
    host.loadInstruction('ISC_PROGRAM');
    host.shiftDr(JtagHost.rowScan(3, new Uint8Array(64).fill(1)));
    expect(chip.device.isBlank).toBe(true);
    expect(host.readStatus().error).toBe(true);
    // Entering programming mode clears the error.
    host.enableIsc();
    expect(host.readStatus()).toMatchObject({ isc: true, error: false });
  });

  test('erase and program pulses keep the device busy; commands during that time are refused', () => {
    const chip = new CpldJtag(new VCpld32(fitCpld(counter4Design()).bits));
    const host = new JtagHost(chip);
    host.reset();
    host.enableIsc();
    host.loadInstruction('ISC_ERASE');
    expect(chip.device.isBlank).toBe(true);
    expect(chip.busyCycles).toBe(ERASE_CYCLES);
    // Polling status with the (idempotent) ISC_ENABLE shows busy, then ready.
    host.idle(2);
    expect(decodeIrCapture(host.loadInstruction('ISC_ENABLE')).busy).toBe(true);
    host.idle(ERASE_CYCLES);
    expect(decodeIrCapture(host.loadInstruction('ISC_ENABLE')).busy).toBe(false);
    // Two rows back to back, without waiting: the second is refused.
    host.loadInstruction('ISC_PROGRAM');
    const ones = new Uint8Array(64).fill(1);
    host.shiftDr(JtagHost.rowScan(0, ones));
    host.shiftDr(JtagHost.rowScan(1, ones));
    expect(chip.device.readRow(0).every((x) => x === 1)).toBe(true);
    expect(chip.device.readRow(1).some((x) => x)).toBe(false);
    expect(chip.error).toBe(true);
    expect(PROGRAM_CYCLES).toBe(3);
  });

  test('programming mode: pins off, flip-flops frozen; leaving it restarts the device', () => {
    const fit = fitCpld(counter4Design());
    const chip = new CpldJtag(fit.device());
    const host = new JtagHost(chip);
    chip.setPin(fit.pinOf.EN!, 1);
    chip.setGlobal('gclk', 1);
    chip.setGlobal('gclk', 0);
    chip.setGlobal('gclk', 1);
    const q0 = fit.mcOf.Q0!.macrocell;
    expect(chip.pinState(q0)).toMatchObject({ driver: 'device', level: 0 }); // two clocks: 2 = 0b10, Q0 = 0
    chip.setGlobal('gclk', 0);
    chip.setGlobal('gclk', 1);
    expect(chip.pinState(q0).level).toBe(1);
    host.reset();
    host.enableIsc();
    expect(chip.pinState(q0).driver).toBe('none');
    chip.setGlobal('gclk', 0);
    chip.setGlobal('gclk', 1); // ignored
    host.disableIsc();
    expect(chip.pinState(q0)).toMatchObject({ driver: 'device', level: 0 }); // restarted at the power-up values
  });

  test('Test-Logic-Reset leaves programming mode', () => {
    const chip = new CpldJtag();
    const host = new JtagHost(chip);
    host.reset();
    host.enableIsc();
    expect(chip.device.iscMode).toBe(true);
    host.reset();
    expect(chip.device.iscMode).toBe(false);
  });

  test('non-volatile: the configuration survives a power cycle; the TAP and the flip-flops restart', () => {
    const fit = fitCpld(bcdDisplayDesign());
    const chip = new CpldJtag();
    const host = new JtagHost(chip);
    host.programDevice(fit.bits);
    chip.setPin(fit.pinOf.EN!, 1);
    for (let i = 0; i < 3; i++) {
      chip.setGlobal('gclk', 1);
      chip.setGlobal('gclk', 0);
    }
    expect(chip.pinState(fit.mcOf.Q0!.macrocell).level).toBe(1); // 3 = 0b0011
    chip.powerCycle();
    expect(chip.state).toBe('Test-Logic-Reset');
    expect(chip.ir).toBe(INSTRUCTIONS.IDCODE);
    expect(Array.from(chip.device.bits)).toEqual(Array.from(fit.bits));
    expect(chip.pinState(fit.mcOf.Q0!.macrocell).level).toBe(0);
    // Still identifies and still verifies through the port.
    const h2 = new JtagHost(chip);
    expect(h2.readIdcode()).toBe(IDCODE_VALUE);
    h2.reset();
    h2.enableIsc();
    expect(h2.verify(fit.bits).ok).toBe(true);
  });

  test('the programming trace: marks for every step, TAP states as the standard has them', () => {
    const fit = fitCpld(counter4Design());
    const host = new JtagHost(new CpldJtag());
    const res = host.programDevice(fit.bits);
    expect(host.trace).toHaveLength(host.cycles);
    expect(res.cycles).toBe(host.cycles);
    const labels = host.marks.map((m) => m.label);
    expect(labels[0]).toContain('Reset');
    for (const step of ['ISC_ENABLE', 'ISC_ERASE', 'ISC_PROGRAM', 'ISC_VERIFY', 'ISC_DISABLE']) expect(labels.some((l) => l.startsWith(step))).toBe(true);
    // Marks are in order and inside the trace.
    host.marks.reduce((prev, m) => {
      expect(m.cycle).toBeGreaterThanOrEqual(prev);
      expect(m.cycle).toBeLessThanOrEqual(host.cycles);
      return m.cycle;
    }, 0);
    // Every TAP state of the machine except the pause and second-exit states was visited.
    const visited = new Set(host.trace.map((c) => c.state));
    for (const s of ['Test-Logic-Reset', 'Run-Test/Idle', 'Select-DR-Scan', 'Capture-DR', 'Shift-DR', 'Exit1-DR', 'Update-DR', 'Select-IR-Scan', 'Capture-IR', 'Shift-IR', 'Exit1-IR', 'Update-IR'] as const) expect(visited.has(s)).toBe(true);
    // The instruction column follows the protocol.
    const seq = host.trace.map((c) => c.instruction).filter((v, i, a) => i === 0 || v !== a[i - 1]);
    expect(seq).toEqual(expect.arrayContaining(['ISC_ENABLE', 'ISC_ERASE', 'ISC_PROGRAM', 'ISC_VERIFY', 'ISC_DISABLE']));
  });

  test('a trace limit stops recording but not the cycles', () => {
    const host = new JtagHost(new CpldJtag(), { traceLimit: 10 });
    host.reset();
    host.idle(30);
    expect(host.trace).toHaveLength(10);
    expect(host.cycles).toBeGreaterThan(30);
    const quiet = new JtagHost(new CpldJtag(), { trace: false });
    quiet.reset();
    expect(quiet.trace).toHaveLength(0);
  });
});

describe('boundary scan', () => {
  const lv = (v: (Level | undefined)[]) => v;

  test('the register: 99 cells, three per pin then GCLK, GSR, GOE; cell 0 is nearest TDO', () => {
    expect(BSR_LENGTH).toBe(99);
    expect(describeBoundaryCell(0)).toMatchObject({ kind: 'input', pin: 0 });
    expect(describeBoundaryCell(1)).toMatchObject({ kind: 'output', pin: 0 });
    expect(describeBoundaryCell(2)).toMatchObject({ kind: 'control', pin: 0 });
    expect(describeBoundaryCell(95)).toMatchObject({ kind: 'control', pin: 31 });
    expect(describeBoundaryCell(96)).toMatchObject({ kind: 'global-input', pin: 'GCLK' });
    expect(describeBoundaryCell(98)).toMatchObject({ kind: 'global-input', pin: 'GOE' });
    expect(() => describeBoundaryCell(99)).toThrow();
    const chip = new CpldJtag();
    const host = new JtagHost(chip);
    host.reset();
    host.loadInstruction('SAMPLE_PRELOAD');
    // The register is 99 bits long: a 1 shifted in appears 99 cycles later.
    const probe = new Uint8Array(200);
    probe[0] = 1;
    const out = host.shiftDr(probe);
    expect(Array.from(out.slice(99, 102))).toEqual([1, 0, 0]);
  });

  test('SAMPLE reads the levels on the pins, from the outside world and from the device, without disturbing it', () => {
    const fit = fitCpld({ inputs: ['A'], outputs: [{ name: 'Y', expr: '!A' }, { name: 'Q', expr: 'A', registered: true, oe: 'A' }] });
    const chip = new CpldJtag(fit.device());
    const host = new JtagHost(chip);
    chip.setPin(fit.pinOf.A!, 0);
    const y = fit.outputs.find((o) => o.name === 'Y')!.pin!;
    const a = fit.pinOf.A!;
    let cells = host.sample();
    expect(cells.input[a]).toBe(0);
    expect(cells.input[y]).toBe(1); // the device drives Y = !A onto the pin
    expect(cells.output[y]).toBe(1);
    expect(cells.control[y]).toBe(1);
    expect(cells.control[a]).toBe(0); // A's pad is an input: nothing drives it
    chip.setPin(a, 1);
    cells = host.sample();
    expect(cells.input[a]).toBe(1);
    expect(cells.input[y]).toBe(0);
    expect(cells.control[fit.pinOf.Q!]).toBe(1); // Q's enable term is A
    chip.setGlobal('goe', 1);
    chip.setGlobal('gsr', 0);
    cells = host.sample();
    expect([cells.gclk, cells.gsr, cells.goe]).toEqual([0, 0, 1]);
    // The core kept running: pins still show the device's outputs.
    expect(chip.pinState(y)).toMatchObject({ driver: 'device', level: 0 });
  });

  test('PRELOAD sets the latches without driving; EXTEST then drives the pins and isolates the core', () => {
    const fit = fitCpld({ inputs: ['A'], outputs: [{ name: 'Y', expr: 'A' }] });
    const chip = new CpldJtag(fit.device());
    const host = new JtagHost(chip);
    chip.setPin(fit.pinOf.A!, 1);
    const y = fit.pinOf.Y!;
    const drive: (Level | undefined)[] = new Array<Level | undefined>(32).fill(undefined);
    drive[y] = 0; // force the output pin low although the core wants it high
    drive[7] = 1;
    host.preload(drive);
    expect(chip.pinState(y)).toMatchObject({ driver: 'device', level: 1 }); // still the core
    expect(chip.pinState(7).driver).toBe('none');
    host.loadInstruction('EXTEST');
    expect(chip.pinState(y)).toMatchObject({ driver: 'device', level: 0 }); // now the latch
    expect(chip.pinState(7)).toMatchObject({ driver: 'device', level: 1 });
    const cells = host.extest(drive);
    expect(cells.input[y]).toBe(0);
    expect(cells.input[7]).toBe(1);
    expect(cells.output[y]).toBe(1); // the core's own output is still captured
    // HIGHZ turns everything off; IDCODE returns to normal operation.
    host.loadInstruction('HIGHZ');
    expect(chip.pinState(y).driver).toBe('none');
    host.loadInstruction('IDCODE');
    expect(chip.pinState(y)).toMatchObject({ driver: 'device', level: 1 });
  });

  test('EXTEST drives an erased device\'s pins: a loopback', () => {
    const chip = new CpldJtag();
    const host = new JtagHost(chip);
    host.reset();
    const drive = lv([1, 0, 1, undefined, undefined, 0, 1]);
    const cells = host.extest(drive);
    expect(cells.input.slice(0, 7)).toEqual([1, 0, 1, 0, 0, 0, 1]);
    expect(cells.control.slice(0, 7)).toEqual([0, 0, 0, 0, 0, 0, 0]); // the core's own enables are off
    expect(chip.pinState(3).driver).toBe('none');
    expect(chip.pinState(6)).toMatchObject({ driver: 'device', level: 1 });
  });

  test('board wiring test: EXTEST on one device, SAMPLE on the other finds an open net and a net stuck low', () => {
    const run = (faults: Record<number, 'open' | 'stuck0' | 'stuck1'>) => {
      const a = new CpldJtag();
      const b = new CpldJtag();
      const board = new JtagBoard();
      // Eight nets from pins 0–7 of A to pins 16–23 of B.
      for (let k = 0; k < 8; k++) board.connect(`N${k}`, { chip: a, pin: k }, { chip: b, pin: 16 + k }, faults[k]);
      const hostA = new JtagHost(a);
      const hostB = new JtagHost(b);
      hostA.reset();
      hostB.reset();
      const bad = new Set<number>();
      // Walking one, then walking zero, so every net is seen high and low.
      for (const idle of [0, 1] as const) {
        for (let k = 0; k < 8; k++) {
          const drive: (Level | undefined)[] = new Array<Level | undefined>(32).fill(undefined);
          for (let j = 0; j < 8; j++) drive[j] = (j === k ? 1 - idle : idle) as Level;
          hostA.extest(drive);
          const seen = hostB.sample();
          for (let j = 0; j < 8; j++) if (seen.input[16 + j] !== drive[j]) bad.add(j);
        }
      }
      return [...bad].sort((x, y) => x - y);
    };
    expect(run({})).toEqual([]);
    expect(run({ 3: 'open' })).toEqual([3]);
    expect(run({ 5: 'stuck0' })).toEqual([5]);
    expect(run({ 2: 'stuck1', 6: 'open' })).toEqual([2, 6]);
  });

  test('a device driving against the board is seen as a conflict', () => {
    const chip = new CpldJtag();
    const host = new JtagHost(chip);
    chip.setPin(4, 1); // the board holds the pin high
    const drive: (Level | undefined)[] = new Array<Level | undefined>(32).fill(undefined);
    drive[4] = 0;
    host.extest(drive);
    expect(chip.pinState(4)).toMatchObject({ driver: 'device', level: 0, conflict: true });
  });

  test('numeric helpers', () => {
    expect(Array.from(numberToBits(0x1c0321ff, 32)).slice(0, 4)).toEqual([1, 1, 1, 1]);
    expect(bitsToNumber(numberToBits(0x1c0321ff, 32))).toBe(0x1c0321ff);
    expect(bitsToNumber(numberToBits(2 ** 32 - 1, 32))).toBe(2 ** 32 - 1);
    expect(ROW_BITS).toBe(64);
  });
});
