/**
 * Bitstream generation from the placed and routed design.
 *
 * - every cell's LUT truth table is permuted to the pins the router chose (ordinary cells) and its flags set;
 * - a tile's flip-flops get the global clock of their cluster;
 * - every routing multiplexer on a route tree selects the node that drives it in the tree;
 * - pads get their direction, block RAMs their width mode, read mode, clocks and initial contents.
 */
import { FabricConfig } from '../devices/vfpga-config';
import type { VFpgaDevice } from '../devices/vfpga';
import type { Packed } from './pack';
import type { Placement } from './place';
import type { RouteResult } from './route';

export interface CellLocation {
  x: number;
  y: number;
  k: number;
}

export interface BitgenResult {
  bits: Uint8Array;
  config: FabricConfig;
  /** Where each cell of the LC netlist went. */
  cellAt: CellLocation[];
  /** LUT pin of each input of each cell (position in `inputs` → pin). */
  pinOfInput: number[][];
}

export function generateBitstream(p: Packed, pl: Placement, r: RouteResult, dev: VFpgaDevice): BitgenResult {
  const cfg = new FabricConfig(dev);
  const nl = p.netlist;
  const cellAt: CellLocation[] = new Array(nl.lcs.length);
  const pinOfInput: number[][] = nl.lcs.map((lc) => lc.inputs.map((_, i) => (lc.fixedPins ? i : -1)));

  // Pins chosen by the router.
  p.nets.forEach((net, ni) => {
    net.sinks.forEach((s, si) => {
      if (s.kind !== 'lc') return;
      const lcId = p.clusters[p.units[s.unit]!.cluster]!.slots[s.slot]!;
      const lc = nl.lcs[lcId]!;
      if (!lc.fixedPins) pinOfInput[lcId]![s.input] = r.pinOf[ni]![si]!;
    });
  });

  for (const c of p.clusters) {
    const x = pl.unitX[c.id]!;
    const y = pl.unitY[c.id]!;
    if (c.clk >= 0) cfg.setTileClock(x, y, p.clockGlobal[c.clk]!, false);
    c.slots.forEach((lcId, k) => {
      if (lcId < 0) return;
      const lc = nl.lcs[lcId]!;
      cellAt[lcId] = { x, y, k };
      // Truth table over the physical pins.
      const pins = pinOfInput[lcId]!;
      let tt = 0;
      if (lc.fixedPins) tt = lc.tt;
      else {
        for (let row = 0; row < 16; row++) {
          let logical = 0;
          pins.forEach((pin, i) => {
            if (pin >= 0 && (row >> pin) & 1) logical |= 1 << i;
          });
          tt |= ((lc.tt >> logical) & 1) << row;
        }
      }
      cfg.setLc(x, y, k, {
        lut: tt,
        i3Carry: lc.i3Carry,
        carryChain: lc.carryChain,
        carryConst: lc.carryConst,
        ff: lc.ff !== undefined,
        ceEn: lc.ff !== undefined && lc.ff.ce >= 0,
        srEn: lc.ff !== undefined && lc.ff.sr >= 0,
        srVal: lc.ff?.srVal ?? 0,
        srAsync: lc.ff?.srAsync ?? false,
        init: lc.ff?.init ?? 0,
      });
    });
  }

  for (const t of r.nets) {
    for (let i = 1; i < t.nodes.length; i++) cfg.select(t.nodes[i]!, t.nodes[t.parents[i]!]!);
  }

  nl.ports.forEach((port, i) => {
    cfg.setPad(pl.unitPad[p.portUnit[i]!]!, { output: port.dir === 'out' });
  });

  nl.rams.forEach((ram, i) => {
    const u = p.ramUnit[i]!;
    const x = pl.unitX[u]!;
    const y = pl.unitY[u]!;
    const g = ram.clk >= 0 ? p.clockGlobal[ram.clk]! : 0;
    cfg.setBram(x, y, { mode: ram.mode, asyncRead: ram.asyncRead, rclk: g, wclk: g, contents: ram.contents });
  });

  return { bits: cfg.bits, config: cfg, cellAt, pinOfInput };
}
