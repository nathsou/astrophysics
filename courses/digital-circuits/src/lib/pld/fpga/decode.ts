/**
 * Fabric simulation from bits: a configuration becomes a netlist of primitives the digital engine can run.
 *
 * Nothing but the bits is consulted. For every logic cell with a non-zero configuration, every configured pad
 * and block RAM, and everything they read (found by walking the routing multiplexers backwards from their
 * inputs), the decoder creates:
 *
 * - `fpga-mux` for every routing multiplexer on the way (only the selected input is connected; its delay is the
 *   node's delay from the published delay model), so signals travel through the same wires the router used;
 * - `fpga-lut4`, and `fpga-dff` when the cell's bypass mux picks the flip-flop;
 * - `fpga-carry` for the carry logic that some cell reads;
 * - `fpga-pad` per pad (its `PAD` net is the outside world: a test bench or the virtual board drives or reads
 *   it) and `fpga-bram` per block RAM;
 * - `const` for a constant carry input.
 *
 * Combinational loops made by hand-configured routing are kept; the engine reports them.
 *
 * Element ids: `LC(x,y,k)/lut`, `/ff`, `/carry`; routing muxes are named after the node they drive
 * (`W(2,1,E,1,0)`); pads `PAD/P3`; block RAMs `RAM(x,y)/blockN`. `fabric` on the result maps nodes to nets and
 * cells to elements for the Studio (cross-probing and colouring wires by value).
 */
import './models';
import type { FlatElement, FlatNetlist, Params } from '../../sim/netlist/types';
import { NK, TILE_BRAM, TILE_IO, TILE_LOGIC, type VFpgaDevice } from '../devices/vfpga';
import { BRAM_BITS, BRAM_WIDTHS, LCS_PER_TILE, LC_BITS, VFPGA_DELAYS as D } from '../devices/vfpga-arch';
import { bramInitOffset, bramOffset, clkNegOffset, clkSelOffset, getBits, lcOffset, padOffset, readBram, readLc, readSelect } from '../devices/vfpga-config';

export interface FabricInfo {
  device: VFpgaDevice;
  /** Net of each routing node (−1 if the node was not needed). */
  nodeNet: Int32Array;
  /** The outside net of each configured or used pad, by pad name. */
  padNets: Map<string, number>;
  /** Element ids of each live logic cell, keyed "x,y,k". */
  cells: Map<string, { lut: string; ff?: string; carry?: string }>;
  /** Element id of the multiplexer driving each node. */
  muxOf: Map<number, string>;
  /** Block RAM element ids by tile "x,y". */
  rams: Map<string, string>;
}

export type DecodedFabric = FlatNetlist & { fabric: FabricInfo };

export function decodeBitstream(dev: VFpgaDevice, bits: Uint8Array): DecodedFabric {
  if (bits.length !== dev.totalBits) throw new Error(`a ${dev.name} configuration has ${dev.totalBits} bits, not ${bits.length}`);
  const N = dev.nodeCount;
  const need = new Uint8Array(N);
  const stack: number[] = [];
  const mark = (n: number) => {
    if (n >= 0 && !need[n]) {
      need[n] = 1;
      stack.push(n);
    }
  };
  const key = (x: number, y: number, k: number) => `${x},${y},${k}`;
  const aliveLc = new Set<string>();
  const carryLc = new Set<string>();
  const alivePad = new Set<number>();
  const aliveRam = new Set<string>();

  const prevCell = (x: number, y: number, k: number): [number, number, number] | undefined => {
    if (k > 0) return [x, y, k - 1];
    if (y > 0 && dev.tileKind[dev.tid(x, y - 1)] === TILE_LOGIC) return [x, y - 1, LCS_PER_TILE - 1];
    return undefined;
  };
  const needCarry = (x: number, y: number, k: number) => {
    const kk = key(x, y, k);
    if (carryLc.has(kk)) return;
    carryLc.add(kk);
    mark(dev.lcIn(x, y, k, 1));
    mark(dev.lcIn(x, y, k, 2));
    if (readLc(dev, bits, x, y, k).carryChain) {
      const p = prevCell(x, y, k);
      if (p) needCarry(...p);
    }
  };
  const makeAlive = (x: number, y: number, k: number) => {
    const kk = key(x, y, k);
    if (aliveLc.has(kk)) return;
    aliveLc.add(kk);
    const c = readLc(dev, bits, x, y, k);
    for (let i = 0; i < 4; i++) mark(dev.lcIn(x, y, k, i));
    if (c.ff) {
      if (c.ceEn) mark(dev.ce(x, y));
      if (c.srEn) mark(dev.sr(x, y));
      mark(dev.gclk(getBits(bits, clkSelOffset(dev, x, y), dev.clkBits)));
    }
    if (c.carryChain || c.i3Carry) {
      const p = c.carryChain ? prevCell(x, y, k) : undefined;
      if (p) needCarry(...p);
    }
  };
  const makePadAlive = (pad: number) => {
    if (alivePad.has(pad)) return;
    alivePad.add(pad);
    if (bits[padOffset(dev, pad)]) mark(dev.padOut(pad));
  };
  const makeRamAlive = (x: number, y: number) => {
    const kk = `${x},${y}`;
    if (aliveRam.has(kk)) return;
    aliveRam.add(kk);
    for (let p = 0; p < 40; p++) mark(dev.ramIn(x, y, p));
    const c = readBram(dev, bits, x, y);
    mark(dev.gclk(c.rclk));
    mark(dev.gclk(c.wclk));
  };

  // Roots: configured cells, pads and RAMs.
  for (let x = 0; x < dev.width; x++) {
    for (let y = 0; y < dev.height; y++) {
      const kind = dev.tileKind[dev.tid(x, y)]!;
      if (kind === TILE_LOGIC) {
        for (let k = 0; k < LCS_PER_TILE; k++) {
          const o = lcOffset(dev, x, y, k);
          let any = false;
          for (let i = 0; i < LC_BITS && !any; i++) any = bits[o + i] === 1;
          if (any) makeAlive(x, y, k);
        }
      } else if (kind === TILE_IO) {
        for (let s = 0; s < dev.spec.padsPerTile; s++) {
          const pad = dev.padAt(x, y, s);
          const o = padOffset(dev, pad);
          if (bits[o] || bits[o + 1]) makePadAlive(pad);
        }
      } else if (kind === TILE_BRAM) {
        const o = bramOffset(dev, x, y);
        let any = false;
        for (let i = 0; i < 3 + 2 * dev.clkBits && !any; i++) any = bits[o + i] === 1;
        const init = bramInitOffset(dev, x, y);
        for (let i = 0; i < BRAM_BITS && !any; i++) any = bits[init + i] === 1;
        if (any) makeRamAlive(x, y);
      }
    }
  }
  // Walk backwards through the multiplexers.
  while (stack.length) {
    const n = stack.pop()!;
    const kind = dev.nodeKind[n]!;
    const x = dev.nodeX[n]!;
    const y = dev.nodeY[n]!;
    if (kind === NK.LCO) makeAlive(x, y, dev.nodeIdx[n]!);
    else if (kind === NK.PADI) makePadAlive(dev.padAt(x, y, dev.nodeIdx[n]!));
    else if (kind === NK.RAMO) makeRamAlive(x, y);
    else if (kind === NK.GCLK) mark(dev.inList[dev.inStart[n]!]!);
    else mark(readSelect(dev, bits, n).input);
  }

  // Nets and elements.
  const netNames: (string | undefined)[] = [];
  const newNet = (name?: string) => netNames.push(name) - 1;
  const nodeNet = new Int32Array(N).fill(-1);
  for (let n = 0; n < N; n++) if (need[n]) nodeNet[n] = newNet(dev.nodeName(n));
  const netOf = (n: number): number => (nodeNet[n]! >= 0 ? nodeNet[n]! : newNet());
  const elements: FlatElement[] = [];
  const el = (id: string, type: string, params: Params, pinNames: string[], pins: number[]) => elements.push({ id, type, params, pins, pinNames });
  const muxOf = new Map<number, string>();
  const cells = new Map<string, { lut: string; ff?: string; carry?: string }>();
  const rams = new Map<string, string>();
  const padNets = new Map<string, number>();

  for (let n = 0; n < N; n++) {
    if (!need[n]) continue;
    const kind = dev.nodeKind[n]!;
    if (kind === NK.LCO || kind === NK.PADI || kind === NK.RAMO) continue;
    let input = -1;
    let code = 0;
    if (kind === NK.GCLK) input = dev.inList[dev.inStart[n]!]!;
    else {
      const r = readSelect(dev, bits, n);
      input = r.input;
      code = r.code;
    }
    if (input < 0) continue;
    const id = dev.nodeName(n);
    muxOf.set(n, id);
    el(id, 'fpga-mux', { delay: dev.nodeDelay[n]!, sel: code, inputs: dev.inStart[n + 1]! - dev.inStart[n]! }, ['A', 'Y'], [nodeNet[input]!, nodeNet[n]!]);
  }

  // Carry outputs and constants.
  const coutNet = new Map<string, number>();
  const constNets = new Map<number, number>();
  const constNet = (v: number): number => {
    let n = constNets.get(v);
    if (n === undefined) {
      n = newNet(`const${v}`);
      constNets.set(v, n);
      el(`const${v}`, 'const', { value: v }, ['Y'], [n]);
    }
    return n;
  };
  const cout = (x: number, y: number, k: number): number => {
    const kk = key(x, y, k);
    let n = coutNet.get(kk);
    if (n === undefined) coutNet.set(kk, (n = newNet(`LC(${x},${y},${k}).cout`)));
    return n;
  };
  const cin = (x: number, y: number, k: number): number => {
    const c = readLc(dev, bits, x, y, k);
    if (!c.carryChain) return constNet(c.carryConst);
    const p = prevCell(x, y, k);
    return p ? cout(...p) : constNet(0);
  };
  for (const kk of carryLc) {
    const [x, y, k] = kk.split(',').map(Number) as [number, number, number];
    const id = `LC(${x},${y},${k})/carry`;
    el(id, 'fpga-carry', { delayData: D.carryData, delayCin: D.carryIn }, ['I1', 'I2', 'CIN', 'COUT'], [netOf(dev.lcIn(x, y, k, 1)), netOf(dev.lcIn(x, y, k, 2)), cin(x, y, k), cout(x, y, k)]);
  }

  for (const kk of aliveLc) {
    const [x, y, k] = kk.split(',').map(Number) as [number, number, number];
    const c = readLc(dev, bits, x, y, k);
    const label = `LC(${x},${y},${k})`;
    const out = netOf(dev.lcOut(x, y, k));
    nodeNet[dev.lcOut(x, y, k)] = out;
    const lutOut = c.ff ? newNet(`${label}.lut`) : out;
    const pins = [0, 1, 2, 3].map((i) => (i === 3 && c.i3Carry ? cin(x, y, k) : netOf(dev.lcIn(x, y, k, i))));
    el(`${label}/lut`, 'fpga-lut4', { truth: c.lut, delay: D.lut }, ['I0', 'I1', 'I2', 'I3', 'O'], [...pins, lutOut]);
    const info: { lut: string; ff?: string; carry?: string } = { lut: `${label}/lut` };
    if (c.ff) {
      const g = getBits(bits, clkSelOffset(dev, x, y), dev.clkBits);
      el(
        `${label}/ff`,
        'fpga-dff',
        { negClk: bits[clkNegOffset(dev, x, y)] === 1, ceEn: c.ceEn, srEn: c.srEn, srVal: c.srVal, srAsync: c.srAsync, init: c.init, tcq: D.ffClkToQ },
        ['D', 'CLK', 'CE', 'SR', 'Q'],
        [lutOut, netOf(dev.gclk(g)), c.ceEn ? netOf(dev.ce(x, y)) : newNet(), c.srEn ? netOf(dev.sr(x, y)) : newNet(), out],
      );
      info.ff = `${label}/ff`;
    }
    if (carryLc.has(kk)) info.carry = `${label}/carry`;
    cells.set(kk, info);
  }

  for (const pad of alivePad) {
    const info = dev.pads[pad]!;
    const o = padOffset(dev, pad);
    const outside = newNet(`pad:${info.name}`);
    padNets.set(info.name, outside);
    const id = `PAD/${info.name}`;
    el(id, 'fpga-pad', { mode: bits[o] ? 'out' : 'in', pullup: bits[o + 1] === 1, delayIn: D.padIn, delayOut: D.padOut }, ['PAD', 'IN', 'OUT'], [outside, netOf(dev.padIn(pad)), netOf(dev.padOut(pad))]);
  }

  for (const kk of aliveRam) {
    const [x, y] = kk.split(',').map(Number) as [number, number];
    const c = readBram(dev, bits, x, y);
    const w = BRAM_WIDTHS[c.mode]!;
    const depth = BRAM_BITS / w;
    const init = bramInitOffset(dev, x, y);
    const words: string[] = [];
    for (let a = 0; a < depth; a++) words.push(getBits(bits, init + a * w, w).toString(16));
    const pinNames: string[] = [];
    const pins: number[] = [];
    const add = (name: string, net: number) => {
      pinNames.push(name);
      pins.push(net);
    };
    for (let i = 0; i < 11; i++) add(`RADDR${i}`, netOf(dev.ramIn(x, y, i)));
    for (let i = 0; i < 11; i++) add(`WADDR${i}`, netOf(dev.ramIn(x, y, 11 + i)));
    for (let i = 0; i < 16; i++) add(`WDATA${i}`, netOf(dev.ramIn(x, y, 22 + i)));
    add('RE', netOf(dev.ramIn(x, y, 38)));
    add('WE', netOf(dev.ramIn(x, y, 39)));
    add('RCLK', netOf(dev.gclk(c.rclk)));
    add('WCLK', netOf(dev.gclk(c.wclk)));
    for (let i = 0; i < 16; i++) {
      const node = dev.ramOut(x, y, i);
      const net = netOf(node);
      nodeNet[node] = net;
      add(`RDATA${i}`, net);
    }
    const id = `RAM(${x},${y})/block`;
    rams.set(kk, id);
    el(id, 'fpga-bram', { mode: c.mode, asyncRead: c.asyncRead, contents: words.join(','), tcq: D.bramClkToQ, tasync: D.bramAsync }, pinNames, pins);
  }

  return { netCount: netNames.length, netNames, elements, fabric: { device: dev, nodeNet, padNets, cells, muxOf, rams } };
}

/**
 * Attach a logic switch (`toggle`, id `TB:<pad>`) to each named input pad and return the nets to read for output
 * pads. For tests and the hand-configuration view; the virtual board does the same with real board elements.
 */
export function attachTestbench(fab: DecodedFabric, inputPads: string[]): void {
  for (const name of inputPads) {
    const net = fab.fabric.padNets.get(name);
    if (net === undefined) throw new Error(`pad ${name} is not part of the configured design`);
    fab.elements.push({ id: `TB:${name}`, type: 'toggle', params: { on: false }, pins: [net], pinNames: ['Y'] });
  }
}
