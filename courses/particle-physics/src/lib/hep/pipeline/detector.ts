/** The detector configuration of a pipeline configuration, kept apart from `run.ts` so that a page can build the event display's geometry without loading the generator and reconstruction. */
import { customise, presets, type DetectorConfig } from '../detector/config.ts';
import { configKey, type DetectorSettings } from './config.ts';

const detectorCache = new Map<string, DetectorConfig>();

/** The detector configuration for some settings: the preset with the knobs applied. The same object comes back for the same settings, so the reconstruction's calibration is done once. */
export function resolveDetector(d: DetectorSettings): DetectorConfig {
  const key = configKey(d);
  let cfg = detectorCache.get(key);
  if (cfg) return cfg;
  const base = d.custom ?? presets[d.preset];
  if (!base) throw new Error(`unknown detector preset "${d.preset}"; available: ${Object.keys(presets).join(', ')}`);
  cfg = customise(base, {});
  if (d.bField !== undefined) cfg.bField = d.bField;
  if (d.trackerResolution !== undefined && d.trackerResolution !== 1) {
    cfg.trackerLayers = cfg.trackerLayers.map((l) => ({ ...l, sigmaRPhi: l.sigmaRPhi * d.trackerResolution!, sigmaZ: l.sigmaZ * d.trackerResolution! }));
  }
  if (d.ecalStochastic !== undefined) cfg.ecal.stochastic = d.ecalStochastic;
  if (d.hcalStochastic !== undefined) cfg.hcal.stochastic = d.hcalStochastic;
  if (d.deadFraction !== undefined) cfg.deadFraction = d.deadFraction;
  if (d.noiseHitsPerLayer !== undefined) cfg.noiseHitsPerLayer = d.noiseHitsPerLayer;
  if (detectorCache.size > 16) detectorCache.clear();
  detectorCache.set(key, cfg);
  return cfg;
}
