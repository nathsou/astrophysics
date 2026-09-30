/**
 * The model of a `place` exercise: a small design taken through the course's own flow up to packing (DCL → RTL →
 * AIG → LUTs → cells → tiles), the annealer's result on a chosen seed, and the placer's wirelength cost of any
 * placement the reader builds by hand. Pure TypeScript; `Place.svelte` is a shell around it.
 *
 * The cost is the wirelength term of `src/lib/pld/fpga/place.ts`: for every net of two to `bigNet` blocks, the
 * half-perimeter of the bounding box of its blocks, times VPR's crossing-count factor `crossing(n)`. The timing and
 * congestion terms the annealer also weighs are not part of the score (the annealer's own `Placement.bb` is this
 * number, which the tests check), but the estimated critical path is shown for both, with the placer's own delay
 * estimate. Legality is `checkPlacement`: sites of the right kind, nothing on top of anything else.
 */
import { check, elaborate } from '$lib/hdl';
import { hasErrors } from '$lib/hdl/diagnostics';
import { getVFpga, TILE_LOGIC, type VFpgaDevice } from '$lib/pld/devices/vfpga';
import type { VFpgaSize } from '$lib/pld/devices/vfpga-arch';
import { detectCarryChains, fromRtl, mapLuts, buildLcNetlist, pack, synthesise, buildTimingGraph, analyse, estimateDelay, checkPlacement, place, type Packed, type Placement } from '$lib/pld/fpga';
import { crossing } from '$lib/pld/fpga/place';
import { sinkLiterals } from '$lib/pld/fpga/design';

export interface PlaceInput {
  id: string;
  title?: string;
  prompt?: string;
  hints?: string[];
  explain?: string;
  /** DCL source of the design (its `top` module, or `top:`). */
  design: string;
  top?: string;
  /** The device (default S, the only one small enough to drag blocks about on a phone). */
  device?: VFpgaSize;
  /** The annealer's seed: the result to beat. */
  seed: number;
  /** Port name → pad name, for ports that are not free to move. */
  pins?: Record<string, string>;
  /** The placement the reader starts from (default: every block on the first free site of its kind). */
  start?: Record<string, string>;
  /** A placement that beats the annealer: block name → `x,y` (a logic tile) or a pad name (`P4`). */
  solution?: Record<string, string>;
  /** The goal as a factor of the annealer's cost (default 1: strictly below it). */
  goal?: number;
}

export interface Block {
  /** Index in `Packed.units`. */
  unit: number;
  kind: 'logic' | 'io' | 'bram';
  /** What to show: `tile 0`, or the port's name. */
  name: string;
  /** Number of logic cells in a logic tile. */
  cells: number;
  /** A block the reader may not move (a clock pad, or a pinned port). */
  fixed: boolean;
}

export interface Site {
  kind: 'logic' | 'io';
  x: number;
  y: number;
  /** Pad index (I/O sites). */
  pad: number;
  name: string;
}

export interface Net {
  name: string;
  /** Block indexes (`Block.unit`), the driver first. */
  blocks: number[];
  /** Whether it counts in the cost. */
  counted: boolean;
}

export interface Problem {
  device: VFpgaDevice;
  packed: Packed;
  blocks: Block[];
  sites: Site[];
  nets: Net[];
  annealer: Placement;
  pins: Record<string, string>;
  /** The annealer's wirelength cost and estimated critical path. */
  annealerCost: number;
  annealerPeriod: number;
  /** Where every block is to begin with. */
  start: Assign;
}

/** Where each block is: the index of its site in `Problem.sites`. */
export type Assign = Int32Array;

export class PlaceError extends Error {}

/** DCL → the packed design. */
export function packDesign(input: Pick<PlaceInput, 'design' | 'top' | 'device'>): { packed: Packed; device: VFpgaDevice } {
  const { diagnostics, program } = check(input.design, { file: 'design.dcl' });
  if (hasErrors(diagnostics)) throw new PlaceError(`The design does not compile: ${diagnostics.find((d) => d.severity === 'error')!.message}`);
  const device = getVFpga(input.device ?? 'S');
  const names = [...program.modules.keys()];
  const rtl = elaborate(program, input.top ?? program.top ?? names[names.length - 1]);
  const d0 = fromRtl(rtl);
  const { design } = synthesise(d0);
  const roots = sinkLiterals(design);
  const carry = detectCarryChains(design.aig, roots, {});
  const map = mapLuts(design.aig, [...roots, ...carry.extraRoots], carry.leaf);
  const netlist = buildLcNetlist(design, map, carry);
  const packed = pack(netlist, device);
  if (packed.macros.length) throw new PlaceError('This design has a carry chain, which is a rigid column of tiles: use one without adders.');
  if (packed.units.some((u) => u.kind === 'bram')) throw new PlaceError('This design uses block RAM.');
  return { packed, device };
}

/** The fixed blocks: clock pads and pinned ports, as the placer fixes them. */
function fixedBlocks(packed: Packed, device: VFpgaDevice, pins: Record<string, string> = {}): Map<number, number> {
  const padByName = new Map(device.pads.map((p) => [p.name, p.index]));
  const fixed = new Map<number, number>();
  packed.netlist.ports.forEach((port, i) => {
    const unit = packed.portUnit[i]!;
    let pad = -1;
    const wanted = pins[port.name];
    if (wanted !== undefined) pad = padByName.get(wanted) ?? -1;
    if (packed.clockGlobal[i]! >= 0) pad = device.gbPads[packed.clockGlobal[i]!]!;
    if (pad >= 0) fixed.set(unit, pad);
  });
  return fixed;
}

export function buildProblem(input: PlaceInput): Problem {
  const { packed, device } = packDesign(input);
  const pins = input.pins ?? {};
  const annealer = place(packed, device, { seed: input.seed, pins });
  const fixed = fixedBlocks(packed, device, pins);
  const blocks: Block[] = packed.units.map((u, i) => ({
    unit: i,
    kind: u.kind,
    name: u.kind === 'logic' ? `tile ${packed.units.slice(0, i).filter((x) => x.kind === 'logic').length}` : u.label.replace(/^port /, ''),
    cells: u.kind === 'logic' ? packed.clusters[u.cluster]!.slots.filter((s) => s >= 0).length : 0,
    fixed: fixed.has(i),
  }));
  const sites: Site[] = [];
  for (let x = 0; x < device.width; x++) for (let y = 0; y < device.height; y++) if (device.tileKind[device.tid(x, y)] === TILE_LOGIC) sites.push({ kind: 'logic', x, y, pad: -1, name: `tile (${x}, ${y})` });
  for (const p of device.pads) sites.push({ kind: 'io', x: p.x, y: p.y, pad: p.index, name: `pad ${p.name}` });
  const nets: Net[] = packed.nets.map((n) => {
    const set = [...new Set([n.driverUnit, ...n.sinks.map((s) => s.unit)])];
    return { name: n.name, blocks: set, counted: set.length >= 2 && set.length <= 64 };
  });
  const problem: Problem = { device, packed, blocks, sites, nets, annealer, pins, annealerCost: 0, annealerPeriod: annealer.estPeriod, start: new Int32Array(blocks.length) };
  problem.annealerCost = cost(problem, assignOf(problem, annealer));
  problem.start = input.start ? fromNames(problem, input.start) : firstFree(problem);
  return problem;
}

/** The site index of every block in a `Placement`. */
export function assignOf(p: Problem, pl: Pick<Placement, 'unitX' | 'unitY' | 'unitPad'>): Assign {
  const a = new Int32Array(p.blocks.length);
  p.blocks.forEach((b, i) => {
    a[i] = p.sites.findIndex((s) => (b.kind === 'io' ? s.kind === 'io' && s.pad === pl.unitPad[i] : s.kind === 'logic' && s.x === pl.unitX[i] && s.y === pl.unitY[i]));
  });
  return a;
}

/** A `Placement`-shaped view of an assignment, for the placer's own legality check. */
export function placementOf(p: Problem, a: Assign): Pick<Placement, 'unitX' | 'unitY' | 'unitPad'> {
  const n = p.blocks.length;
  const unitX = new Int16Array(n);
  const unitY = new Int16Array(n);
  const unitPad = new Int16Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const s = p.sites[a[i]!];
    if (!s) continue;
    unitX[i] = s.x;
    unitY[i] = s.y;
    if (s.kind === 'io') unitPad[i] = s.pad;
  }
  return { unitX, unitY, unitPad };
}

/** The wirelength cost of an assignment: what the placer adds up (`bb`). Blocks at a missing site count at the origin. */
export function cost(p: Problem, a: Assign): number {
  let total = 0;
  for (const n of p.nets) {
    if (!n.counted) continue;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const b of n.blocks) {
      const s = p.sites[a[b]!];
      const x = s?.x ?? 0;
      const y = s?.y ?? 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    total += crossing(n.blocks.length) * (x1 - x0 + (y1 - y0));
  }
  return total;
}

/** The placer's estimate of the critical path (ns) for an assignment: the delay of every connection from its tile distance. */
export function period(p: Problem, a: Assign): number {
  const pl = placementOf(p, a);
  const tg = buildTimingGraph(p.packed);
  const conn = new Float64Array(tg.connections.length);
  tg.connections.forEach((c, k) => {
    const net = p.packed.nets[c.net]!;
    const sink = net.sinks[c.sink]!;
    conn[k] = estimateDelay(pl.unitX[sink.unit]! - pl.unitX[net.driverUnit]!, pl.unitY[sink.unit]! - pl.unitY[net.driverUnit]!);
  });
  return analyse(tg, conn).period;
}

/** Everything that makes a placement illegal, in words. */
export function legality(p: Problem, a: Assign): string[] {
  const out: string[] = [];
  const seen = new Map<number, number>();
  p.blocks.forEach((b, i) => {
    const s = p.sites[a[i]!];
    if (!s) return void out.push(`${b.name} is not on a site.`);
    if ((b.kind === 'io') !== (s.kind === 'io')) return void out.push(`${b.name} cannot go on ${s.name}.`);
    const other = seen.get(a[i]!);
    if (other !== undefined) out.push(`${b.name} and ${p.blocks[other]!.name} are both on ${s.name}.`);
    seen.set(a[i]!, i);
  });
  if (!out.length) for (const e of checkPlacement(p.packed, p.device, placementOf(p, a) as Placement)) out.push(e);
  // Fixed blocks stay where the design says.
  const fixed = fixedBlocks(p.packed, p.device, p.pins);
  for (const [unit, pad] of fixed) {
    const s = p.sites[a[unit]!];
    if (s && s.kind === 'io' && s.pad !== pad) out.push(`${p.blocks[unit]!.name} is fixed to pad ${p.device.pads[pad]!.name}.`);
  }
  return out;
}

export interface Score {
  legal: boolean;
  problems: string[];
  cost: number;
  period: number;
  /** The annealer's, for the same seed. */
  annealer: number;
  annealerPeriod: number;
  /** Whether the goal is met. */
  beats: boolean;
  goal: number;
}

export function score(input: Pick<PlaceInput, 'goal'>, p: Problem, a: Assign): Score {
  const problems = legality(p, a);
  const c = cost(p, a);
  const goal = (input.goal ?? 1) * p.annealerCost;
  return { legal: problems.length === 0, problems, cost: c, period: problems.length ? NaN : period(p, a), annealer: p.annealerCost, annealerPeriod: p.annealerPeriod, beats: problems.length === 0 && (input.goal === undefined || input.goal === 1 ? c < p.annealerCost - 1e-9 : c <= goal + 1e-9), goal };
}

// ── Starting points and saved placements ────────────────────────────────────────

/** Every block on the first free site of its kind (fixed blocks where they belong). */
export function firstFree(p: Problem): Assign {
  const a = new Int32Array(p.blocks.length).fill(-1);
  const taken = new Set<number>();
  const fixed = fixedBlocks(p.packed, p.device, p.pins);
  for (const [unit, pad] of fixed) {
    const s = p.sites.findIndex((q) => q.kind === 'io' && q.pad === pad);
    a[unit] = s;
    taken.add(s);
  }
  p.blocks.forEach((b, i) => {
    if (a[i]! >= 0) return;
    const s = p.sites.findIndex((q, k) => q.kind === (b.kind === 'io' ? 'io' : 'logic') && !taken.has(k));
    a[i] = s;
    taken.add(s);
  });
  return a;
}

/** A placement from names: `{ 'tile 0': '1,1', clk: 'P4' }`. Blocks that are not named keep the first free site. */
export function fromNames(p: Problem, named: Record<string, string>): Assign {
  const a = firstFree(p);
  const used = new Set<number>();
  const setAt: [number, number][] = [];
  for (const [name, where] of Object.entries(named)) {
    const i = p.blocks.findIndex((b) => b.name === name);
    if (i < 0) throw new PlaceError(`no block called ${name}`);
    const w = String(where).trim();
    const s = /^\d+\s*,\s*\d+$/.test(w)
      ? p.sites.findIndex((q) => q.kind === 'logic' && `${q.x},${q.y}` === w.replace(/\s+/g, ''))
      : p.sites.findIndex((q) => q.kind === 'io' && q.name === `pad ${w}`);
    if (s < 0) throw new PlaceError(`no site ${w}`);
    setAt.push([i, s]);
    used.add(s);
  }
  // Move the unnamed blocks off the sites taken by named ones.
  const named_ = new Set(setAt.map(([i]) => i));
  for (const [i, s] of setAt) a[i] = s;
  const taken = new Set<number>(used);
  p.blocks.forEach((b, i) => {
    if (named_.has(i)) return;
    if (!taken.has(a[i]!)) return void taken.add(a[i]!);
    const s = p.sites.findIndex((q, k) => q.kind === (b.kind === 'io' ? 'io' : 'logic') && !taken.has(k));
    a[i] = s;
    taken.add(s);
  });
  return a;
}

/** The names of an assignment, the format `fromNames` and the exercise's `solution` use. */
export function toNames(p: Problem, a: Assign): Record<string, string> {
  return Object.fromEntries(p.blocks.map((b, i) => [b.name, b.kind === 'io' ? p.sites[a[i]!]!.name.replace(/^pad /, '') : `${p.sites[a[i]!]!.x},${p.sites[a[i]!]!.y}`]));
}

/** Search for a placement with low wirelength cost: annealing with only the wirelength term, several seeds, then pair swaps. For authors (it makes the exercise's solution); not used in the page. */
export function search(p: Problem, tries = 12): Assign {
  let best: Assign | undefined;
  let bestCost = Infinity;
  for (let s = 1; s <= tries; s++) {
    const pl = place(p.packed, p.device, { seed: 1000 + s, timing: false, spread: 0, pins: p.pins, innerNum: 4 });
    const a = assignOf(p, pl);
    if (legality(p, a).length) continue;
    const c = cost(p, a);
    if (c < bestCost) {
      best = a;
      bestCost = c;
    }
  }
  if (!best) throw new PlaceError('no legal placement found');
  // Pair swaps to a local optimum.
  const a = best.slice();
  const fixedUnits = new Set(p.blocks.filter((b) => b.fixed).map((b) => b.unit));
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < a.length; i++) {
      if (fixedUnits.has(i)) continue;
      for (let s = 0; s < p.sites.length; s++) {
        if (p.sites[s]!.kind !== (p.blocks[i]!.kind === 'io' ? 'io' : 'logic')) continue;
        const j = a.indexOf(s);
        if (j === i || (j >= 0 && fixedUnits.has(j))) continue;
        const before = cost(p, a);
        const old = a[i]!;
        a[i] = s;
        if (j >= 0) a[j] = old;
        if (cost(p, a) < before - 1e-9) improved = true;
        else {
          a[i] = old;
          if (j >= 0) a[j] = s;
        }
      }
    }
  }
  return a;
}
