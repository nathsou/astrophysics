/**
 * The muon g − 2 scoreboard of Chapter 32: published values of the muon's anomalous magnetic moment a_μ = (g − 2)/2, in units of 10⁻¹¹, with the
 * arithmetic that turns two of them into a number of standard deviations. Every value is quoted from the source named in its `source` field; nothing is computed
 * from data here.
 */
export interface Value {
  id: string;
  kind: 'experiment' | 'theory';
  label: string;
  /** a_μ in units of 10⁻¹¹. */
  value: number;
  /** One standard deviation, units of 10⁻¹¹. */
  error: number;
  source: string;
}

export const VALUES: Value[] = [
  { id: 'bnl', kind: 'experiment', label: 'Brookhaven E821 (2006)', value: 116592089, error: 63, source: 'Bennett et al., Phys. Rev. D 73, 072003 (2006)' },
  { id: 'fnal21', kind: 'experiment', label: 'Fermilab, first result (2021)', value: 116592040, error: 54, source: 'Abi et al., Phys. Rev. Lett. 126, 141801 (2021)' },
  { id: 'fnal25', kind: 'experiment', label: 'Fermilab, final result (2025)', value: 116592070.5, error: 14.8, source: 'Muon g − 2 Collaboration, arXiv:2506.03069 (2025)' },
  { id: 'avg25', kind: 'experiment', label: 'Experimental world average (2025)', value: 116592071.5, error: 14.5, source: 'Muon g − 2 Collaboration, arXiv:2506.03069 (2025)' },
  { id: 'wp20', kind: 'theory', label: 'Theory White Paper 2020 (data-driven HVP)', value: 116591810, error: 43, source: 'Aoyama et al., Phys. Rep. 887, 1 (2020)' },
  { id: 'wp25', kind: 'theory', label: 'Theory White Paper 2025 (lattice-QCD HVP)', value: 116592033, error: 62, source: 'Aliberti et al., arXiv:2505.21476 (2025)' },
];

/** The difference (experiment − theory) in standard deviations, adding the two uncertainties in quadrature (our arithmetic, not a quoted significance). */
export function pull(exp: Value, th: Value): { diff: number; sigma: number; z: number } {
  const diff = exp.value - th.value;
  const sigma = Math.hypot(exp.error, th.error);
  return { diff, sigma, z: diff / sigma };
}
