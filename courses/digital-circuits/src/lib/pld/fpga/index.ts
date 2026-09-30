/**
 * The FPGA toolchain: synthesis, LUT mapping, carry chains, packing, placement, routing, timing, bitstream, and the
 * fabric simulator. See `flow.ts` for the whole flow and each stage's module for its own API.
 */
export { runFlow, type FlowOptions, type FlowResult } from './flow';
export { designFromNetlist, SUPPORTED_TYPES } from './frontend';
export { fromRtl } from './fromrtl';
export { FlowError, type Design, type Port, type Reg, type Ram, type SourceInfo } from './design';
export { Aig, rebuild } from './aig';
export { synthesise, type SynthTrace } from './synth';
export { mapLuts, type MapResult, type MappedLut } from './map';
export { detectCarryChains, type CarryChain, type CarryPlan } from './carry';
export { buildLcNetlist, type LcNetlist, type LcSpec, type RamBlock } from './lcnet';
export { pack, type Packed } from './pack';
export { place, checkPlacement, estimateDelay, type Placement, type PlaceTrace, type PlaceStep, type PlaceOptions } from './place';
export { route, checkRouting, type RouteResult, type RouteIteration, type RouteOptions } from './route';
export { buildTimingGraph, analyse, type TimingGraph, type TimingResult } from './sta';
export { generateBitstream, type BitgenResult } from './bitgen';
export { decodeBitstream, attachTestbench, type DecodedFabric, type FabricInfo } from './decode';
export { crossProbe, probeCell, probeNode, type CrossProbe } from './crossprobe';
export { buildReport, formatReport, type FlowReport } from './report';
export { FPGA_TYPES } from './models';
