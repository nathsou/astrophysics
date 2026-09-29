/**
 * The FPGA flow: netlist → synthesis → LUT mapping (with carry chains) → packing → placement → routing →
 * static timing analysis → bitstream, with a report and cross-probing data.
 *
 * Everything runs synchronously in plain TypeScript, with typed arrays in the placer and the router; a worker can
 * wrap `runFlow` (the result is plain data apart from the class instances noted in `FlowResult`).
 *
 * Each stage is also exported on its own (`synthesise`, `mapLuts`, `detectCarryChains`, `buildLcNetlist`, `pack`,
 * `place`, `route`, `analyse`, `generateBitstream`) so a view can run and replay them one by one.
 */
import type { FlatNetlist } from '../../sim/netlist/types';
import { getVFpga, type VFpgaDevice } from '../devices/vfpga';
import type { VFpgaSize } from '../devices/vfpga-arch';
import { encodeBitstream } from '../devices/vfpga-config';
import { generateBitstream, type BitgenResult } from './bitgen';
import { detectCarryChains, type CarryPlan } from './carry';
import { crossProbe, type CrossProbe } from './crossprobe';
import { FlowError, sinkLiterals, type Design } from './design';
import { designFromNetlist } from './frontend';
import { buildLcNetlist, type LcNetlist } from './lcnet';
import { mapLuts, type MapOptions, type MapResult } from './map';
import { pack, type Packed } from './pack';
import { checkPlacement, place, type PlaceOptions, type Placement } from './place';
import { buildReport, type FlowReport } from './report';
import { checkRouting, route, type RouteOptions, type RouteResult } from './route';
import { analyse, type TimingResult } from './sta';
import { synthesise, type SynthOptions, type SynthTrace } from './synth';

export interface FlowOptions {
  /** Target device (default: the smallest that the design fits, tried in order S, M, L). */
  device?: VFpgaSize | VFpgaDevice;
  seed?: number;
  synth?: SynthOptions;
  map?: MapOptions;
  /** Infer carry chains (default true) and the shortest chain worth building. */
  carry?: boolean;
  minCarryStages?: number;
  place?: PlaceOptions;
  route?: RouteOptions;
  /** Port name → pad name. */
  pins?: Record<string, string>;
  /** Extra placement attempts with other seeds when routing fails (default 2). */
  retries?: number;
  /** Called when a stage starts and ends (for progress bars and logs). */
  progress?: (stage: string, phase: 'start' | 'end', ms?: number) => void;
}

export interface FlowResult {
  device: VFpgaDevice;
  design: Design;
  synthTrace: SynthTrace;
  map: MapResult;
  carry: CarryPlan;
  netlist: LcNetlist;
  packed: Packed;
  placement: Placement;
  routing: RouteResult;
  timing: TimingResult;
  bitgen: BitgenResult;
  /** The bitstream file (`encodeBitstream`). */
  bitstream: Uint8Array;
  report: FlowReport;
  probe: CrossProbe;
  /** Milliseconds per stage. */
  times: Record<string, number>;
  log: string[];
}

export function runFlow(input: FlatNetlist | Design, opts: FlowOptions = {}): FlowResult {
  const times: Record<string, number> = {};
  const log: string[] = [];
  const stage = <T>(name: string, f: () => T): T => {
    const t = performance.now();
    opts.progress?.(name, 'start');
    try {
      return f();
    } finally {
      const dt = performance.now() - t;
      times[name] = (times[name] ?? 0) + dt;
      opts.progress?.(name, 'end', dt);
    }
  };

  const design0: Design = 'aig' in input ? input : stage('front end', () => designFromNetlist(input));
  for (const w of design0.warnings) log.push(`warning: ${w}`);
  const { design, trace: synthTrace } = stage('synthesis', () => synthesise(design0, opts.synth));
  const last = synthTrace.passes[synthTrace.passes.length - 1]!;
  log.push(`synthesis: ${last.ands} AND nodes, depth ${last.depth}`);

  const roots = sinkLiterals(design);
  const carry = stage('carry chains', () => (opts.carry === false ? { chains: [], leaf: new Uint8Array(design.aig.n), extraRoots: [], candidates: 0 } : detectCarryChains(design.aig, roots, { minStages: opts.minCarryStages })));
  log.push(`carry: ${carry.chains.length} chain(s), ${carry.chains.reduce((s, c) => s + c.stages.length, 0)} stages`);
  const map = stage('lut mapping', () => mapLuts(design.aig, [...roots, ...carry.extraRoots], carry.leaf, opts.map));
  log.push(`mapping: ${map.luts.length} LUTs, depth ${map.depth} (optimal ${map.trace.optimalDepth})`);
  const netlist = stage('cell netlist', () => buildLcNetlist(design, map, carry));

  const tryDevices: VFpgaDevice[] = opts.device === undefined ? (['S', 'M', 'L'] as const).map((s) => getVFpga(s)) : [typeof opts.device === 'string' ? getVFpga(opts.device) : opts.device];
  let device: VFpgaDevice | undefined;
  let packed: Packed | undefined;
  let lastError: unknown;
  for (const d of tryDevices) {
    try {
      packed = stage('packing', () => pack(netlist, d));
      device = d;
      const fits = netlist.rams.length <= d.counts.brams && netlist.ports.length <= d.counts.pads && netlist.ports.filter((q) => q.clock).length <= d.spec.globals;
      if (fits || d === tryDevices[tryDevices.length - 1]) break;
      lastError = new FlowError(`The design does not fit ${d.name}.`, 'packing');
      packed = undefined;
    } catch (e) {
      lastError = e;
      if (!(e instanceof FlowError)) throw e;
    }
  }
  if (!device || !packed) throw lastError;
  log.push(`packing: ${packed.stats.clusters} tiles on ${device.name}`);

  const retries = opts.retries ?? 2;
  let placement: Placement | undefined;
  let routing: RouteResult | undefined;
  const seed = opts.seed ?? 1;
  for (let attempt = 0; attempt <= retries; attempt++) {
    placement = stage('placement', () => place(packed!, device!, { pins: opts.pins, ...opts.place, seed: seed + attempt }));
    const problems = checkPlacement(packed, device, placement);
    if (problems.length) throw new FlowError(`Illegal placement: ${problems[0]}`, 'placement');
    routing = stage('routing', () => route(packed!, placement!, device!, opts.route));
    log.push(`placement (seed ${seed + attempt}): wirelength cost ${placement.bb.toFixed(0)}, ${placement.trace.steps.length} temperatures`);
    log.push(`routing: ${routing.iterations.length} iteration(s), ${routing.success ? 'no overuse' : `${routing.overused} overused nodes`}`);
    if (routing.success) break;
    if (attempt < retries) log.push('routing failed; placing again with another seed');
  }
  if (!placement || !routing) throw new FlowError('internal error: no placement', 'placement');
  if (!routing.success) throw new FlowError(`Routing failed: ${routing.overused} routing nodes are still overused after ${routing.iterations.length} iterations on ${device.name}.`, 'routing');
  const problems = checkRouting(packed, routing, device);
  if (problems.length) throw new FlowError(`Illegal routing: ${problems[0]}`, 'routing');

  const timing = stage('timing analysis', () => analyse(routing!.graph, routing!.connDelay));
  log.push(`timing: critical path ${timing.period.toFixed(2)} ns, fmax ${timing.fmaxMHz.toFixed(1)} MHz`);
  const bitgen = stage('bitstream', () => generateBitstream(packed!, placement!, routing!, device!));
  const bitstream = encodeBitstream(device, bitgen.bits);
  const probe = stage('cross-probing', () => crossProbe(design, netlist, packed!, placement!, routing!, bitgen, device!));
  const report = buildReport({ device, design, netlist, packed, placement, routing, timing, map, carry, synth: synthTrace, times, warnings: netlist.warnings });
  return { device, design, synthTrace, map, carry, netlist, packed, placement, routing, timing, bitgen, bitstream, report, probe, times, log };
}
