/** The machine stage of a configuration, kept apart from `run.ts` so that a page can compute it without loading the generator, detector and reconstruction. */
import { machineStage, type MachineStageResult } from '../machine/index.ts';
import type { PipelineConfig } from './config.ts';

/** The machine stage of a configuration: luminosity, pile-up, crossing rate (the luminosity formula runs through the hook `machine.luminosity`). */
export function machineOf(c: PipelineConfig): MachineStageResult {
  const m = c.machine;
  return machineStage({
    mode: m.mode,
    beamEnergyGeV: m.sqrtS / 2,
    bunchIntensity: m.beam?.bunchIntensity,
    nBunches: m.beam?.nBunches,
    epsN: m.beam?.epsN,
    betaStar: m.beam?.betaStar,
    crossingAngle: m.beam?.crossingAngle,
    sigmaZ: m.beam?.sigmaZ,
    lumi: m.lumi,
    bunchSpacingNs: m.bunchSpacingNs,
  });
}
