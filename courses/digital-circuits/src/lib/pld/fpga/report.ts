/**
 * The flow report: utilisation, timing (fmax and the critical path with its routing nodes), the sizes the stages
 * produced, and the time each stage took.
 */
import { NK, type VFpgaDevice } from '../devices/vfpga';
import type { CarryPlan } from './carry';
import type { Design } from './design';
import type { LcNetlist } from './lcnet';
import type { MapResult } from './map';
import type { Packed } from './pack';
import type { Placement } from './place';
import type { RouteResult } from './route';
import type { TimingResult } from './sta';
import type { SynthTrace } from './synth';

export interface Utilisation {
  used: number;
  total: number;
  percent: number;
}

export interface PathReportStep {
  kind: 'launch' | 'cell' | 'net' | 'capture';
  name: string;
  delay: number;
  arrival: number;
  /** For net steps: the routing nodes from the driver's pin to the sink pin. */
  route?: string[];
}

export interface FlowReport {
  device: string;
  utilisation: {
    cells: Utilisation;
    luts: number;
    flipFlops: number;
    carryCells: number;
    tiles: Utilisation;
    blockRams: Utilisation;
    pads: Utilisation;
    globalClocks: Utilisation;
    routingNodes: Utilisation;
    wires: number;
  };
  timing: { periodNs: number; fmaxMHz: number; endpoint: string; path: PathReportStep[] };
  sizes: { andNodes: number; aigDepth: number; luts: number; lutDepth: number; optimalDepth: number; carryChains: number; nets: number; routingIterations: number; temperatures: number };
  stages: { name: string; ms: number }[];
  totalMs: number;
  warnings: string[];
}

const util = (used: number, total: number): Utilisation => ({ used, total, percent: total ? (100 * used) / total : 0 });

export function buildReport(x: {
  device: VFpgaDevice;
  design: Design;
  netlist: LcNetlist;
  packed: Packed;
  placement: Placement;
  routing: RouteResult;
  timing: TimingResult;
  map: MapResult;
  carry: CarryPlan;
  synth: SynthTrace;
  times: Record<string, number>;
  warnings: string[];
}): FlowReport {
  const { device, netlist, packed, routing, timing } = x;
  const tg = routing.graph;
  const path: PathReportStep[] = timing.path.map((s) => {
    const step: PathReportStep = { kind: s.kind, name: s.name, delay: s.delay, arrival: s.arrival };
    if (s.kind === 'net' && s.conn >= 0) {
      const c = tg.connections[s.conn]!;
      const t = routing.nets.find((n) => n.net === c.net);
      const sinkNode = t?.sinkNodes[c.sink];
      if (t && sinkNode !== undefined && sinkNode >= 0) {
        const chain: string[] = [];
        let i = t.nodes.indexOf(sinkNode);
        while (i >= 0) {
          chain.push(device.nodeName(t.nodes[i]!));
          i = t.parents[i]!;
        }
        step.route = chain.reverse();
      }
    }
    return step;
  });
  const wires = routing.nets.reduce((s, t) => s + t.nodes.filter((n) => device.nodeKind[n] === NK.WIRE).length, 0);
  const luts = netlist.lcs.filter((l) => l.kind === 'lut' || l.kind === 'const' || l.kind === 'invert' || l.kind === 'ff').length;
  const stages = Object.entries(x.times).map(([name, ms]) => ({ name, ms }));
  const lastPass = x.synth.passes[x.synth.passes.length - 1]!;
  return {
    device: device.name,
    utilisation: {
      cells: util(netlist.lcs.length, device.counts.lcs),
      luts,
      flipFlops: netlist.lcs.filter((l) => l.ff).length,
      carryCells: netlist.chains.reduce((s, c) => s + c.length, 0),
      tiles: util(packed.clusters.length, device.counts.logicTiles),
      blockRams: util(netlist.rams.length, device.counts.brams),
      pads: util(netlist.ports.length, device.counts.pads),
      globalClocks: util(netlist.ports.filter((p) => p.clock).length, device.spec.globals),
      routingNodes: util(routing.stats.nodesUsed, device.nodeCount),
      wires,
    },
    timing: { periodNs: timing.period, fmaxMHz: timing.fmaxMHz, endpoint: timing.endpoint, path },
    sizes: {
      andNodes: lastPass.ands,
      aigDepth: lastPass.depth,
      luts: x.map.luts.length,
      lutDepth: x.map.depth,
      optimalDepth: x.map.trace.optimalDepth,
      carryChains: x.carry.chains.length,
      nets: packed.nets.length,
      routingIterations: routing.iterations.length,
      temperatures: x.placement.trace.steps.length,
    },
    stages,
    totalMs: stages.reduce((s, t) => s + t.ms, 0),
    warnings: x.warnings,
  };
}

/** The report as text, for the Studio's log pane and for tests. */
export function formatReport(r: FlowReport): string {
  const u = (n: string, v: Utilisation) => `  ${n.padEnd(14)} ${v.used} / ${v.total} (${v.percent.toFixed(1)} %)`;
  const lines = [
    `Report for ${r.device}`,
    'Utilisation',
    u('logic cells', r.utilisation.cells),
    `  ${'flip-flops'.padEnd(14)} ${r.utilisation.flipFlops}, carry cells ${r.utilisation.carryCells}`,
    u('logic tiles', r.utilisation.tiles),
    u('block RAMs', r.utilisation.blockRams),
    u('pads', r.utilisation.pads),
    u('global clocks', r.utilisation.globalClocks),
    u('routing nodes', r.utilisation.routingNodes),
    `Timing: critical path ${r.timing.periodNs.toFixed(2)} ns, fmax ${r.timing.fmaxMHz.toFixed(1)} MHz, ending at ${r.timing.endpoint}`,
  ];
  for (const s of r.timing.path) lines.push(`  ${s.arrival.toFixed(2).padStart(6)} ns  +${s.delay.toFixed(2)}  ${s.kind.padEnd(7)} ${s.name}${s.route ? `  via ${s.route.length} nodes` : ''}`);
  lines.push('Stages');
  for (const s of r.stages) lines.push(`  ${s.name.padEnd(14)} ${s.ms.toFixed(1)} ms`);
  lines.push(`  ${'total'.padEnd(14)} ${r.totalMs.toFixed(1)} ms`);
  return lines.join('\n');
}
