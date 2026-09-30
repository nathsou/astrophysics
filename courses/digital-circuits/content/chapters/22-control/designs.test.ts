import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { check, createRtlSim, elaborate, format, renderTestResult, runTests } from '$lib/hdl';
import { CONTROL_LINES, ROUTINES, referenceLines, routineOfByte, type ControlLine } from '../21-datapath/hardware/control-word';
import { OCTET_CONDITIONS } from '$lib/sim/cpu/octet';

/**
 * The DCL of Chapter 22 is the hardwired control unit in a form that a synthesiser could read. It must compile, follow
 * the course's formatting, pass its own tests, and, above all, ask for exactly the lines that the microprogram (which the
 * gate-level circuits of both control units are tested against, in differential.test.ts) asks for, in every step of
 * every one of the 256 first bytes.
 */
const read = (name: string) => readFileSync(new URL(`./designs/${name}`, import.meta.url), 'utf8');
const decode = read('octet-decode.dcl');

describe('octet-decode.dcl', () => {
  test('compiles without a warning and is in the standard format', () => {
    const r = check(decode, { file: 'octet-decode.dcl' });
    expect(r.diagnostics).toEqual([]);
    expect(format(decode).trim()).toBe(decode.trim());
  });

  test('its own tests pass', () => {
    const r = runTests(decode, { file: 'octet-decode.dcl' });
    expect(r.results.length).toBeGreaterThanOrEqual(3);
    for (const t of r.results) expect(t.passed, renderTestResult(r.source, t)).toBe(true);
  });

  test('all 8 × 256 × 2 combinations of step, IR and jump outcome give the microprogram’s lines', () => {
    const design = elaborate(check(decode).program, 'OctetDecode');
    const sim = createRtlSim(design);
    const names: Record<string, ControlLine> = {
      oe_rd: 'OE_RD', oe_rs: 'OE_RS', oe_pc: 'OE_PC', oe_sp: 'OE_SP', oe_alu: 'OE_ALU', oe_mem: 'OE_MEM', oe_t: 'OE_T',
      ld_mar: 'LD_MAR', ld_ir: 'LD_IR', ld_a: 'LD_A', ld_b: 'LD_B', ld_t: 'LD_T', we_r: 'WE_R', ld_flags: 'LD_FLAGS',
      pc_ld: 'PC_LD', pc_inc: 'PC_INC', sp_inc: 'SP_INC', sp_dec: 'SP_DEC', mem_wr: 'MEM_WR', bsel_a: 'BSEL_A', bsel_1: 'BSEL_1', halt: 'HALT',
    };
    let checked = 0;
    for (let stage = 0; stage < 8; stage++) {
      sim.set('stage', stage);
      for (let ir = 0; ir < 256; ir++) {
        sim.set('ir', ir);
        for (const taken of [0, 1]) {
          sim.set('taken', taken);
          const want = referenceLines(stage, ir, !!taken);
          for (const [dcl, line] of Object.entries(names)) if (sim.get(dcl) !== want[line]) throw new Error(`stage ${stage}, ir 0x${ir.toString(16)}, taken ${taken}: ${dcl} = ${sim.get(dcl)}, microprogram says ${want[line]}`);
          const alu = sim.get('alu_op');
          if (alu !== (want.ALU_OP0 | (want.ALU_OP1 << 1) | (want.ALU_OP2 << 2))) throw new Error(`stage ${stage}, ir 0x${ir.toString(16)}: alu_op = ${alu}`);
          // `last` is the END bit of the step's micro-instruction.
          const routine = ROUTINES.find((r) => r.name === routineOfByte(ir))!;
          const end = stage >= 3 && stage - 3 < routine.steps.length ? routine.steps[stage - 3]!.fields.end : 0;
          if (sim.get('last') !== end) throw new Error(`stage ${stage}, ir 0x${ir.toString(16)}: last = ${sim.get('last')}, END = ${end}`);
          checked++;
        }
      }
    }
    expect(checked).toBe(4096);
    expect(CONTROL_LINES).toHaveLength(25);
    void OCTET_CONDITIONS;
  });

  test('the sequencer counts 0…7, restarts on `last` and holds on `halt`', () => {
    const design = elaborate(check(decode).program, 'OctetSequencer');
    const sim = createRtlSim(design);
    sim.set('last', 0);
    sim.set('halt', 0);
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      seen.push(sim.get('stage'));
      sim.tick();
    }
    sim.set('last', 1);
    sim.tick();
    expect(seen).toEqual([0, 1, 2, 3, 4]);
    expect(sim.get('stage')).toBe(0);
    sim.set('last', 0);
    sim.tick();
    sim.set('halt', 1);
    sim.tick();
    sim.tick();
    expect(sim.get('stage')).toBe(1);
  });
});

describe('the DCL shown in the chapter is the DCL of the design files', () => {
  test('every line of every ```dcl block appears, unchanged, in a design file', () => {
    const md = readFileSync(new URL('./index.md', import.meta.url), 'utf8');
    const sources = ['octet-decode.dcl'].map((f) => read(f).split('\n').map((l) => l.trim()));
    const all = new Set(sources.flat());
    const blocks = [...md.matchAll(/```dcl\n([\s\S]*?)```/g)].map((m) => m[1]!);
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks)
      for (const line of b.split('\n').map((l) => l.trim()).filter((l) => l && l !== '…'))
        expect(all.has(line), line).toBe(true);
  });
});
