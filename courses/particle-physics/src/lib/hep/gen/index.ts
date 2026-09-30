/**
 * `hep/gen`: the event generator. See README.md for the API, the physics of each process and what is checked against what.
 *
 *     import { generate, crossSection, getProcess } from 'hep/gen';
 *     const ev = generate('pp->Z->mumu', { sqrtS: 13000, pileup: 20 }, rng(7));
 */
export { generate, type GenerateConfig } from './generate.ts';
export {
  type Process, type ProcessConfig, type Beams, type PointSpec, type MCProcessDef,
  getProcess, listProcesses, registerProcess, makeMCProcess,
  newEvent, addParticle, addBeams, decayAbout, decayIsotropic, boostZ, conservation,
} from './process.ts';
export {
  Vegas, type VegasResult, Unweighter, type UnweightState, unweight, crossSection, type CrossSectionResult,
  breitWignerMap, powerMap, linearMap, mixMap, gaussLegendre, integrateMapped, type Mapping,
} from './integrate.ts';
export {
  xf, pdf, pdfAll, luminosity, partonPairs, momentumFraction, numberFraction, slotOf,
  PDF_Q0, PDF_Q_MAX, PDF_X_MIN, type ParticlePair,
} from './pdf.ts';
export { ee2mumuDiffXsec, eeToFermions, bhabha, bhabhaDiffXsec, rRatioWithZ, type EeOptions, type EeProcess } from './ee.ts';
export { drellYan, wBoson, zPrime, zPrimeWidth, zPrimeCouplings, type DrellYanOptions, type WOptions, type ZPrimeSpec } from './drellyan.ts';
export { dijets, diphoton, qcdMatrixElements, boxSumSquared, type DijetOptions, type DiphotonOptions } from './qcd.ts';
export { higgsGGF, higgsBranching, kFactorFor, type HiggsOptions, type HiggsDecay } from './higgs.ts';
export { ttbar, sigmaHatGG, sigmaHatQQ, topMatrixElements, topDecayBranching, type TopOptions, type TopDecay } from './top.ts';
export { minimumBias, minimumBiasEvent, dNchDeta, sigmaInelMb, meanCharged, negativeBinomial, type MinBiasOptions } from './minbias.ts';
export { ewCoefficients, ewDiff, ewTotal, ewAfb, zExchange, zKappa, type Exchange, type Chiral, type EwCoefficients } from './ewkernel.ts';

/** The hook names registered by this module. */
export const HOOKS = ['gen.unweight', 'gen.dsigmaEeMuMu'] as const;
