import { describe, expect, it } from 'vitest';
import { check, elaborate, hasErrors, runTests } from '../../hdl';
import { bindBoard } from './board';
import { FabricSim, boardPorts } from './fabric-sim';
import { FPGA_EXAMPLES, HEX_COUNTER, fpgaExample } from './examples';
import { flowOf } from './fixture.test-util';
import { digitOfMask } from './board';
import { emptyBoardInputs } from './board';

describe('examples', () => {
  it('lists the reference designs and the board design, with sources', () => {
    expect(FPGA_EXAMPLES.map((e) => e.id)).toEqual(['counter', 'traffic-light', 'hex-counter', 'alu', 'regfile', 'rv32i']);
    for (const e of FPGA_EXAMPLES) {
      expect(e.source).not.toContain('not found');
      expect(e.source.length).toBeGreaterThan(100);
    }
    expect(fpgaExample('alu')?.size).toBe('M');
  });

  it('checks every example without errors', () => {
    for (const e of FPGA_EXAMPLES) {
      const r = check(e.source, { file: `${e.id}.dcl` });
      expect(hasErrors(r.diagnostics), e.id).toBe(false);
    }
  });

  it('passes the hex counter’s own test', () => {
    const r = runTests(HEX_COUNTER, { file: 'hex.dcl' });
    expect(r.results.every((t) => t.passed)).toBe(true);
  });

  it('runs the hex counter from the bits on the board: digits count in hex', () => {
    const f = flowOf('hex', 'HexCounter', 'M', HEX_COUNTER);
    expect(f.result.size).toBe('M');
    const binding = bindBoard(boardPorts(f.design));
    expect(binding.errors).toEqual([]);
    expect(binding.uses.digits).toEqual([0, 1, 2, 3]);
    const sim = new FabricSim(f.device, f.result.bits, { ports: f.result.ports, binding, design: f.design, periodNs: f.result.critical.periodNs });
    const inputs = emptyBoardInputs();
    sim.setInputs(inputs);
    for (let i = 0; i < 300; i++) sim.clock();
    const b = sim.board();
    // 300 = 0x012c
    expect(b.digits.map(digitOfMask)).toEqual([12, 2, 1, 0]);
    expect(b.leds.map((v) => (v === 1 ? 1 : 0)).reduce<number>((a, v, i) => a | (v << i), 0)).toBe(300 & 255);
    expect(sim.compare().mismatches).toEqual([]);
    // Pausing holds.
    inputs.buttons[0] = true;
    sim.setInputs(inputs);
    for (let i = 0; i < 5; i++) sim.clock();
    expect(sim.board().digits.map(digitOfMask)).toEqual([12, 2, 1, 0]);
  });
});
void elaborate;
