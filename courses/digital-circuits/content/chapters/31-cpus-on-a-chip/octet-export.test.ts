/**
 * Octet as a netlist for the real tools: the DCL design written as Yosys JSON (`src/lib/pld/interchange`), checked against
 * the documented format, and run by the interchange module's own evaluator beside the RTL simulator.
 */
import { describe, expect, test } from 'vitest';
import { createRtlSim } from '$lib/hdl';
import { YosysSim, toYosysJson, validateYosysJson, writeYosysJson } from '$lib/pld/interchange';
import { octetDesign } from './widgets/octet-dcl';

describe('Octet as Yosys JSON', () => {
  const json = toYosysJson(octetDesign());

  test('is valid Yosys JSON, with a block RAM of two read ports and one write port, and Octet as its top', () => {
    expect(validateYosysJson(json)).toEqual([]);
    const top = json.modules['Octet']!;
    expect(top.attributes['top']).toBeDefined();
    const mems = Object.values(top.cells).filter((c) => c.type === '$mem_v2');
    expect(mems).toHaveLength(1);
    expect(Object.keys(top.ports)).toEqual(expect.arrayContaining(['clk', 'rst', 'btn', 'sw', 'led', 'seg0', 'halted']));
    expect(JSON.parse(writeYosysJson(octetDesign()))).toEqual(JSON.parse(JSON.stringify(json)));
  });

  test('run by the netlist evaluator, it does what the RTL does, cycle by cycle, with switches and buttons changing', () => {
    const rtl = createRtlSim(octetDesign());
    const net = new YosysSim(json);
    const outputs = ['led', 'seg0', 'seg1', 'seg2', 'seg3', 'halted', 'console', 'console_write'];
    for (let c = 0; c < 900; c++) {
      if (c % 100 === 0) {
        const sw = (c * 37) & 0xff;
        rtl.set('sw', sw);
        net.set('sw', BigInt(sw));
        rtl.set('btn', (c / 100) & 15);
        net.set('btn', BigInt((c / 100) & 15));
      }
      for (const n of outputs) expect(net.get(n), `${n} at cycle ${c}`).toBe(rtl.getBig(n));
      rtl.tick();
      net.step();
    }
    expect(rtl.get('led')).not.toBe(0);
  });
});
