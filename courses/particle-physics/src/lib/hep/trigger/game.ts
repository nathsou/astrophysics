/**
 * The model behind the trigger game and the trigger exercise: the catalogue's default settings and slider ranges, the budgets,
 * and the score. Pure functions over `RateReport` (no rendering).
 *
 * Budgets: Level 1 keeps at most 100 kHz and the HLT at most 1 kHz (about 1 GB/s at 1 MB per event). If a stage is over budget the
 * readout cannot take the extra events and drops them at random, so every sample's efficiency falls by budget/rate. The score is the
 * importance-weighted mean of the efficiency for the signal samples (events in the detector's acceptance), in percent.
 */
import { HLT_OUTPUT_RATE_HZ, L1_OUTPUT_RATE_HZ } from './level1.ts';
import type { ItemSetting, RateReport } from './menu.ts';
import { TOY_SAMPLES } from './toy.ts';

export interface SettingRange { min: number; max: number; step: number }
export const SETTING_RANGES: Record<string, SettingRange> = {
  SingleMu: { min: 3, max: 60, step: 1 },
  DoubleMu: { min: 2, max: 30, step: 1 },
  SingleEG: { min: 5, max: 80, step: 1 },
  DoubleEG: { min: 5, max: 50, step: 1 },
  SingleJet: { min: 20, max: 500, step: 5 },
  HT: { min: 50, max: 1000, step: 10 },
  MET: { min: 20, max: 300, step: 5 },
  BPhys: { min: 2, max: 15, step: 0.5 },
};
/** The HLT applies the same kind of cut with its better measurement, slightly tighter: 10% above the L1 threshold (none for B physics). */
export const hltThresholdFor = (key: string, l1Threshold: number): number => (key === 'BPhys' ? l1Threshold : Math.round(l1Threshold * 1.1 * 2) / 2);
export const PRESCALES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 10000];

export function makeSetting(key: string, l1Threshold: number, prescale = 1, enabled = true): ItemSetting {
  return { key, l1Threshold, hltThreshold: hltThresholdFor(key, l1Threshold), prescale, enabled };
}
/** A reasonable starting menu for 2 × 10³⁴ cm⁻² s⁻¹. */
export function suggestedSettings(): ItemSetting[] {
  return [
    makeSetting('SingleMu', 26), makeSetting('DoubleMu', 10), makeSetting('SingleEG', 34), makeSetting('DoubleEG', 22),
    makeSetting('SingleJet', 200), makeSetting('HT', 300), makeSetting('MET', 110), makeSetting('BPhys', 5, 500),
  ];
}
/** The game's starting menu: thresholds low enough that nothing interesting is missed, and far too loose for the budgets. */
export function startSettings(): ItemSetting[] {
  return [
    makeSetting('SingleMu', 12), makeSetting('DoubleMu', 5), makeSetting('SingleEG', 15), makeSetting('DoubleEG', 10),
    makeSetting('SingleJet', 60), makeSetting('HT', 150), makeSetting('MET', 60), makeSetting('BPhys', 4),
  ];
}
/** Every threshold at its minimum and no prescale: catches everything, overwhelms everything. */
export function looseSettings(): ItemSetting[] {
  return Object.entries(SETTING_RANGES).map(([key, r]) => makeSetting(key, r.min));
}

export interface Budget { l1Hz: number; hltHz: number }
export const DEFAULT_BUDGET: Budget = { l1Hz: L1_OUTPUT_RATE_HZ, hltHz: HLT_OUTPUT_RATE_HZ };

export interface SampleScore {
  key: string;
  label: string;
  role: 'signal' | 'background';
  importance: number;
  /** Fiducial efficiency before and after the budget penalties. */
  efficiency: number;
  effective: number;
  error: number;
}
export interface MenuScore {
  score: number;
  /** Survival fractions imposed by the budgets (1 = within budget). */
  l1Factor: number;
  hltFactor: number;
  l1Rate: number;
  hltRate: number;
  overL1: boolean;
  overHlt: boolean;
  samples: SampleScore[];
}

/** Score a rate report. `only` restricts the score to some sample keys (the exercise). */
export function scoreReport(report: RateReport, budget: Budget = DEFAULT_BUDGET, only?: readonly string[]): MenuScore {
  const l1Factor = report.l1Total > budget.l1Hz ? budget.l1Hz / report.l1Total : 1;
  const afterL1 = report.hltTotal * l1Factor;
  const hltFactor = afterL1 > budget.hltHz ? budget.hltHz / afterL1 : 1;
  const f = l1Factor * hltFactor;
  const samples: SampleScore[] = report.samples.map((s) => {
    const info = TOY_SAMPLES.find((t) => t.key === s.name);
    return {
      key: s.name,
      label: info?.label ?? s.name,
      role: info?.role ?? 'signal',
      importance: only ? (only.includes(s.name) ? 1 : 0) : (info?.importance ?? 0),
      efficiency: s.fiducialEfficiency,
      effective: s.fiducialEfficiency * f,
      error: s.fiducialError * f,
    };
  });
  let num = 0, den = 0;
  for (const s of samples) { if (s.role === 'signal') { num += s.importance * s.effective; den += s.importance; } }
  return { score: den > 0 ? (100 * num) / den : 0, l1Factor, hltFactor, l1Rate: report.l1Total, hltRate: report.hltTotal, overL1: l1Factor < 1, overHlt: hltFactor < 1, samples };
}
