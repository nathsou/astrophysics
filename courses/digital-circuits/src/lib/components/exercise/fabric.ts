/**
 * The vFPGA-S side of the `route` and `decode` exercises: building a configuration from a few lines of YAML (logic
 * cells, pads, routes), tracing what drives a routing node, and simulating a configuration on the fabric simulator
 * (the decoded bitstream on the digital engine, as the by-hand widget's goal check does).
 */
import { getVFpga, type VFpgaDevice } from '$lib/pld/devices/vfpga';
import { FabricConfig, padOffset, readLc, readSelect } from '$lib/pld/devices/vfpga-config';
import { attachTestbench, decodeBitstream } from '$lib/pld/fpga/decode';
import { createDigitalEngine } from '$lib/sim/digital';
import { truthFromExpression } from '$lib/studio/fpga/lut';

export interface CellSpec {
  /** Tile column and row of the logic tile, and the cell in it (0 to 7). */
  at: [number, number, number];
  /** The LUT: a truth table (`0x6666`), or an expression over I0 to I3 (`I0 ^ I1`). */
  lut: number | string;
  /** The cell's flip-flop is used. */
  ff?: boolean;
}

export interface FabricSpec {
  cells?: CellSpec[];
  /** Pad name → direction. Pads not listed keep their power-up setting (input). */
  pads?: Record<string, 'in' | 'out'>;
  /** Routes, each from a source to a sink: `["P0", "LC(1,1,0).I0"]`. */
  routes?: [string, string][];
}

export const device = (): VFpgaDevice => getVFpga('S');

const LC_RE = /^LC\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)(?:\.I([0-3]))?$/i;
const PAD_RE = /^P(\d+)$/i;

/** The routing node a route end names. A pad is its input buffer as a source and its output buffer as a sink; `LC(x,y,k)` is a cell's output, `LC(x,y,k).I2` one of its inputs. */
export function nodeOf(dev: VFpgaDevice, text: string, role: 'source' | 'sink'): number {
  const t = text.trim();
  const pad = PAD_RE.exec(t);
  if (pad) {
    const i = Number(pad[1]);
    if (i >= dev.pads.length) throw new Error(`there is no pad ${t}`);
    return role === 'source' ? dev.padIn(i) : dev.padOut(i);
  }
  const lc = LC_RE.exec(t);
  if (lc) {
    const [x, y, k] = [Number(lc[1]), Number(lc[2]), Number(lc[3])];
    if (lc[4] === undefined) {
      if (role === 'sink') throw new Error(`${t} is a cell's output: name an input of the cell (${t}.I0 to .I3) as a sink`);
      return dev.lcOut(x, y, k);
    }
    if (role === 'source') throw new Error(`${t} is a cell's input: a source is the cell's output, ${t.replace(/\.I\d$/i, '')}`);
    return dev.lcIn(x, y, k, Number(lc[4]));
  }
  throw new Error(`"${t}" is not a pad (P0) or a logic cell (LC(1,1,0), LC(1,1,0).I2)`);
}

/** What a node is called on screen and in messages: `P0`, `LC(1,1,0)`, `LC(1,1,0).I2`. */
export function nodeLabel(dev: VFpgaDevice, n: number): string {
  const name = dev.nodeName(n);
  const pad = /^PAD[IO]\((\d+),(\d+),(\d+)\)$/.exec(name);
  if (pad) return dev.pads[dev.padAt(Number(pad[1]), Number(pad[2]), Number(pad[3]))]?.name ?? name;
  const lco = /^LCO\((\d+),(\d+),(\d+)\)$/.exec(name);
  if (lco) return `LC(${lco[1]},${lco[2]},${lco[3]})`;
  const lci = /^LCI\((\d+),(\d+),(\d+),(\d+)\)$/.exec(name);
  if (lci) return `LC(${lci[1]},${lci[2]},${lci[3]}).I${lci[4]}`;
  return name;
}

export const lutOf = (c: CellSpec): number => (typeof c.lut === 'number' ? c.lut & 0xffff : truthFromExpression(c.lut));

/** The configuration a spec describes: its cells and pads, and (when asked) its routes. */
export function buildFabric(spec: FabricSpec, routes = true, dev: VFpgaDevice = device()): FabricConfig {
  const cfg = new FabricConfig(dev);
  for (const c of spec.cells ?? []) {
    cfg.setLut(c.at[0], c.at[1], c.at[2], lutOf(c));
    if (c.ff) cfg.setLc(c.at[0], c.at[1], c.at[2], { ff: true });
  }
  for (const [name, dir] of Object.entries(spec.pads ?? {})) cfg.setPad(name, { output: dir === 'out' });
  if (routes) for (const [from, to] of spec.routes ?? []) cfg.route(nodeOf(dev, from, 'source'), nodeOf(dev, to, 'sink'));
  return cfg;
}

/** Follows the multiplexers back from a node to what drives it: a source node, or −1 when something on the way selects nothing. */
export function traceDriver(dev: VFpgaDevice, bits: Uint8Array, node: number): { source: number; path: number[]; loop: boolean } {
  const path = [node];
  const seen = new Set([node]);
  let n = node;
  for (;;) {
    if (dev.cfgOffset[n]! < 0) return { source: n, path, loop: false };
    const s = readSelect(dev, bits, n);
    if (s.input < 0) return { source: -1, path, loop: false };
    n = s.input;
    if (seen.has(n)) return { source: -1, path, loop: true };
    seen.add(n);
    path.push(n);
  }
}

/** The bits that are not routing select fields: cells, pads and clocks. */
export function lockedMask(dev: VFpgaDevice): Uint8Array {
  const mask = new Uint8Array(dev.totalBits).fill(1);
  for (let n = 0; n < dev.nodeCount; n++) {
    const off = dev.cfgOffset[n]!;
    if (off >= 0) for (let i = 0; i < dev.cfgWidth[n]!; i++) mask[off + i] = 0;
  }
  return mask;
}

/** Whether every non-routing bit of `bits` equals the starting configuration's. */
export function lockedIntact(dev: VFpgaDevice, bits: Uint8Array, start: Uint8Array): boolean {
  const mask = lockedMask(dev);
  for (let i = 0; i < mask.length; i++) if (mask[i] && bits[i] !== start[i]) return false;
  return true;
}

export type Level = '0' | '1' | 'x' | 'z';

/** Simulate the decoded configuration for every input combination (the first input is the most significant bit). */
export function simulateFabric(dev: VFpgaDevice, bits: Uint8Array, inputs: string[], outputs: string[]): { rows: Level[][]; problems: string[] } {
  const problems: string[] = [];
  const fab = decodeBitstream(dev, bits);
  const inPads = inputs.filter((p) => fab.fabric.padNets.has(p));
  for (const p of inputs) if (!fab.fabric.padNets.has(p)) problems.push(`nothing is connected to pad ${p} yet`);
  const outNets = outputs.map((o) => fab.fabric.padNets.get(o));
  outputs.forEach((o, i) => {
    const pad = dev.pads.find((p) => p.name === o);
    if (pad && !bits[padOffset(dev, pad.index)]) problems.push(`pad ${o} is set to input, not output`);
    else if (outNets[i] === undefined) problems.push(`pad ${o} is not connected: connect a cell's output to it`);
  });
  attachTestbench(fab, inPads);
  const eng = createDigitalEngine(fab, { powerUp: 'x' });
  const n = inputs.length;
  const rows: Level[][] = [];
  for (let v = 0; v < 1 << n; v++) {
    inputs.forEach((p, i) => inPads.includes(p) && eng.setParam(`TB:${p}`, 'on', ((v >> (n - 1 - i)) & 1) === 1));
    eng.advance(200e-9);
    rows.push(
      outNets.map((net): Level => {
        if (net === undefined) return 'x';
        const l = eng.logic(fab.alias?.[net] ?? net);
        return l === 0 ? '0' : l === 1 ? '1' : l === 3 ? 'z' : 'x';
      }),
    );
  }
  return { rows, problems };
}

/** The cells that are configured, for a listing: where, the truth table, the flags. */
export function configuredCells(dev: VFpgaDevice, bits: Uint8Array): { at: [number, number, number]; name: string; lut: number; ff: boolean }[] {
  const out: { at: [number, number, number]; name: string; lut: number; ff: boolean }[] = [];
  for (let x = 0; x < dev.width; x++)
    for (let y = 0; y < dev.height; y++) {
      if (dev.tileKind[dev.tid(x, y)] !== 1) continue;
      for (let k = 0; k < 8; k++) {
        const c = readLc(dev, bits, x, y, k);
        if (c.lut || c.ff) out.push({ at: [x, y, k], name: `LC(${x},${y},${k})`, lut: c.lut, ff: c.ff });
      }
    }
  return out;
}
