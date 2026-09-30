/**
 * Run the configured chip from its bits and compare it with the RTL simulator, cycle by cycle, for the 4-bit counter
 * of Chapter 29 fitted on the vFPGA-S (Figure 30.7). The bits are the ones the flow made; the reader can flip some.
 * What runs is the *decoded bitstream* on the digital engine (`FabricSim`, the same object the Studio's board uses),
 * so a flipped bit changes the circuit and the comparison notices.
 */
import { check, elaborate, type RtlDesign } from '$lib/hdl';
import { getVFpga, type VFpgaDevice } from '$lib/pld/devices/vfpga';
import { bindBoard, emptyBoardInputs } from '$lib/studio/fpga/board';
import { FabricSim, boardPorts } from '$lib/studio/fpga/fabric-sim';
import { fpgaExample } from '$lib/studio/fpga/examples';
import { runFpgaFlow } from '$lib/studio/fpga/result';
import type { FpgaResult } from '$lib/studio/fpga/types';

export interface LutCell {
  label: string;
  x: number;
  y: number;
  k: number;
  /** Index in the configuration of the cell's first LUT bit. */
  offset: number;
  kind: string;
}

export interface Setup {
  design: RtlDesign;
  result: FpgaResult;
  device: VFpgaDevice;
  cells: LutCell[];
}

export function setup(): Setup {
  const src = fpgaExample('counter')!.source;
  const design = elaborate(check(src, { file: 'counter.dcl' }).program, 'Counter');
  const result = runFpgaFlow(design, { device: 'S' });
  const cells = result.cells.filter((c) => c.kind === 'lut' || c.kind === 'ff').map((c) => ({ label: c.label, x: c.x, y: c.y, k: c.k, offset: c.bitOffset, kind: c.kind }));
  return { design, result, device: getVFpga('S'), cells };
}

export interface Run {
  /** The count on the chip after each clock, or 'x' when a bit is unknown. */
  fabric: (number | 'x')[];
  /** The count according to the RTL simulator. */
  rtl: number[];
  /** Cycle (1-based) of the first disagreement, or 0 if the two agree throughout. */
  firstMismatch: number;
  /** The output bits that ever disagreed. */
  mismatched: string[];
  /** Output bits compared each cycle. */
  checked: number;
}

export type Stimulus = 'held' | 'varied';

/** Whether `enable` is high during cycle `i` (1-based): always, or high except every third cycle. */
export const enableAt = (stimulus: Stimulus, i: number): boolean => stimulus === 'held' || i % 3 !== 0;

/** Clock the counter `cycles` times, with the enable held high or varied. */
export function run(s: Setup, bits: Uint8Array, cycles = 20, stimulus: Stimulus = 'held'): Run {
  const binding = bindBoard(boardPorts(s.design));
  const sim = new FabricSim(s.device, bits, { ports: s.result.ports, binding, design: s.design, periodNs: s.result.critical.periodNs });
  const inputs = emptyBoardInputs();
  inputs.free.enable = true;
  sim.setInputs(inputs);
  const out: Run = { fabric: [], rtl: [], firstMismatch: 0, mismatched: [], checked: 0 };
  for (let i = 1; i <= cycles; i++) {
    inputs.free.enable = enableAt(stimulus, i);
    sim.setInputs(inputs);
    sim.clock();
    let v = 0;
    let x = false;
    for (let b = 0; b < 4; b++) {
      const l = sim.output(`count[${b}]`);
      if (l === 1) v |= 1 << b;
      else if (l !== 0) x = true;
    }
    out.fabric.push(x ? 'x' : v);
    out.rtl.push(Number(sim.rtl!.getBig('count')));
    const c = sim.compare();
    out.checked = c.checked;
    for (const m of c.mismatches) if (!out.mismatched.includes(m)) out.mismatched.push(m);
    if (c.mismatches.length && !out.firstMismatch) out.firstMismatch = i;
  }
  return out;
}
