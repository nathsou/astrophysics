/**
 * Runs the flow and boils its result down to plain data (`FpgaResult`): what the worker sends and the panes use.
 * Pure (no DOM, no worker), so tests run it directly.
 */
import type { RtlDesign, RtlModule } from '../../hdl/rtl';
import { getVFpga, NK, type VFpgaDevice } from '../../pld/devices/vfpga';
import { fromRtl, runFlow, type FlowResult } from '../../pld/fpga';
import type { FpgaCritical, FpgaPort, FpgaResult, FpgaRoutedNet, FpgaUnit, VFpgaSize } from './types';

export interface FlowParams {
  device?: VFpgaSize;
  seed?: number;
  pins?: Record<string, string>;
  progress?: (stage: string, phase: 'start' | 'end', ms?: number) => void;
}

/** The critical path with its routing nodes and cells (the report has the nodes only as names). */
function critical(f: FlowResult): FpgaCritical {
  const { routing, packed, placement, device, timing, report } = f;
  const g = routing.graph;
  const nodes: number[] = [];
  const cells = new Set<string>();
  const cellOf = (unit: number, slot: number) => {
    const u = packed.units[unit]!;
    if (u.kind === 'logic') cells.add(`${placement.unitX[unit]},${placement.unitY[unit]},${slot}`);
  };
  const steps = report.timing.path.map((s, i) => {
    const raw = timing.path[i]!;
    const own: number[] = [];
    if (s.kind === 'net' && raw.conn >= 0) {
      const c = g.connections[raw.conn]!;
      const t = routing.nets.find((n) => n.net === c.net);
      const pn = packed.nets[c.net]!;
      const sink = pn.sinks[c.sink]!;
      cellOf(pn.driverUnit, pn.driverSlot);
      if (sink.kind === 'lc' || sink.kind === 'ce' || sink.kind === 'sr') cellOf(sink.unit, sink.slot);
      const sinkNode = t?.sinkNodes[c.sink];
      if (t && sinkNode !== undefined && sinkNode >= 0) {
        let k = t.nodes.indexOf(sinkNode);
        while (k >= 0) {
          own.push(t.nodes[k]!);
          k = t.parents[k]!;
        }
        own.reverse();
      }
    }
    nodes.push(...own);
    return { ...s, nodes: own };
  });
  void device;
  return { periodNs: timing.period, fmaxMHz: timing.fmaxMHz, endpoint: timing.endpoint, steps, nodes: [...new Set(nodes)], cells: [...cells] };
}

/** The plain-data summary of a flow result. */
export function summarise(f: FlowResult): FpgaResult {
  const dev = f.device;
  const nl = f.netlist;
  const ports: FpgaPort[] = nl.ports.map((p, i) => {
    const pad = dev.pads[f.placement.unitPad[f.packed.portUnit[i]!]!]!;
    return { name: p.name, dir: p.dir, clock: p.clock, pad: pad.name, padIndex: pad.index, x: pad.x, y: pad.y };
  });
  const units: FpgaUnit[] = f.packed.units.map((u) => ({
    kind: u.kind,
    label: u.label,
    cells: u.kind === 'logic' ? f.packed.clusters[u.cluster]!.slots.filter((s) => s >= 0).length : 0,
  }));
  const links: number[] = [];
  f.packed.nets.forEach((n, i) => n.sinks.forEach((s) => links.push(n.driverUnit, s.unit, i)));
  const nets = f.probe.nets;
  const routed: FpgaRoutedNet[] = f.routing.nets.map((t, i) => ({ index: i, name: f.packed.nets[t.net]!.name, nodes: t.nodes, parents: t.parents }));
  const bySource: FpgaResult['bySource'] = {};
  for (const [id, t] of Object.entries(f.probe.bySource)) bySource[id] = { nets: t.nets, pads: t.pads, rams: t.rams };
  const tr = f.placement.trace;
  return {
    size: dev.size,
    deviceName: dev.name,
    bits: f.bitgen.bits,
    bitstream: f.bitstream,
    report: f.report,
    times: f.times,
    log: f.log,
    sources: f.design.sources.map((s) => ({ id: s.id, path: s.path, type: s.type, line: s.line, col: s.col })),
    cells: f.probe.cells,
    cellIndex: f.probe.cellIndex,
    nets,
    ports,
    place: {
      units,
      unitX: f.placement.unitX,
      unitY: f.placement.unitY,
      unitPad: f.placement.unitPad,
      steps: tr.steps,
      snapshots: tr.snapshots.map((s) => ({ iter: s.iter, bb: s.bb, x: s.x, y: s.y, pad: s.pad })),
      initial: tr.initial,
      bb: f.placement.bb,
      timing: f.placement.timing,
      estPeriod: f.placement.estPeriod,
      seed: f.placement.seed,
      links: Int32Array.from(links),
    },
    route: {
      success: f.routing.success,
      iterations: f.routing.iterations,
      overusedNodes: f.routing.overusedNodes,
      nets: routed,
    },
    critical: critical(f),
    bySource,
    designName: f.design.name,
  };
}

/** The routed net (an index in `FpgaResult.nets`) that uses each routing node, −1 if none. */
export function nodeNets(r: FpgaResult, dev: VFpgaDevice): Int32Array {
  const out = new Int32Array(dev.nodeCount).fill(-1);
  r.nets.forEach((n, i) => n.nodes.forEach((node) => (out[node] = i)));
  return out;
}

export interface FlowOutcome {
  result: FpgaResult;
  device: VFpgaDevice;
}

/** `fromRtl` and `runFlow` on an elaborated design. Throws `FlowError` (with `stage` and `elements`) when the design does not fit. */
export function runFpgaFlow(design: RtlDesign | RtlModule, params: FlowParams = {}): FpgaResult {
  const flow = runFlow(fromRtl(design), { device: params.device, seed: params.seed, pins: params.pins, progress: params.progress, place: { snapshots: 40 } });
  return summarise(flow);
}

export { getVFpga, NK };
