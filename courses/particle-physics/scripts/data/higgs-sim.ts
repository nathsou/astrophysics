/**
 * The simulated Higgs samples of Chapter 29, made by the course's own pipeline: machine → generator → detector → reconstruction → trigger.
 * Nothing here is real data. Run it from the course directory (Node 22.6 or later, no extra packages):
 *
 *     node --experimental-strip-types scripts/data/higgs-sim.ts
 *
 * It writes static/data/higgs-gamgam-sim.{bin,manifest.json} and static/data/higgs-4l-sim.{bin,manifest.json}. Every random number comes from a
 * seeded generator, so a rerun gives the same files. It takes about ten minutes.
 *
 * What is simulated, and how
 *   machine       pp at √s = 8 TeV (the 2012 energy), no pile-up. The simulated data set stands for 9.9 fb⁻¹ (the background pool's luminosity).
 *   generator     hep/gen at leading order: gg → H → γγ and gg → H → ZZ* → 4ℓ through the heavy-top vertex, and the qq̄/gg → γγ continuum with
 *                 pT > 24 GeV, with the parton shower and the toy hadronisation. The continuum is generated only where it matters, with the true
 *                 diphoton mass between 95 and 175 GeV and pT > m/4 − 3 GeV: the fraction of the generator's cross-section that this keeps is
 *                 counted, so the pool has an exact cross-section (σ_filtered). The reducible backgrounds (a jet that looks like a photon) are NOT simulated.
 *   detector      hep/detector, the `cms-like` preset.
 *   reconstruction hep/reco: photons, electrons and muons with their isolation.
 *   trigger       hep/trigger: the menu of the Chapter 27 game (`suggestedSettings`); an event is flagged when any item passes Level 1 and the HLT.
 *
 * Output (little-endian Int16 records; see the manifests)
 *   γγ:  [flags, pT₁·40, η₁·4000, φ₁·4000, isoTrack₁·2000, isoCalo₁·2000, pT₂·40, η₂·4000, φ₂·4000, isoTrack₂·2000, isoCalo₂·2000]
 *        flags bit 0 = signal event, bit 1 = passed the trigger. Only events with at least two reconstructed photons are stored (the others are counted).
 *   4ℓ:  [flags, then for each of the four hardest leptons: code, pT·40, η·4000, φ·4000, iso·2000]  code = ±11 (e∓) or ±13 (μ∓) as PDG ids.
 *        Only events with at least four reconstructed electrons or muons are stored.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { rng } from '../../src/lib/hep/random/index.ts';
import { diphoton, generate, getProcess, type Process } from '../../src/lib/hep/gen/index.ts';
import { presets, simulate } from '../../src/lib/hep/detector/index.ts';
import { reconstruct } from '../../src/lib/hep/reco/index.ts';
import { evaluateMenu, menuFromSettings, suggestedSettings } from '../../src/lib/hep/trigger/index.ts';
import { machineStage } from '../../src/lib/hep/machine/index.ts';
import { pairMass } from '../../src/lib/hep/kinematics/index.ts';

const out = path.resolve(import.meta.dirname, '../../static/data');
mkdirSync(out, { recursive: true });

const SQRT_S = 8000;
const FAST = process.env.FAST === '1'; // a small run to check the script: FAST=1 node --experimental-strip-types scripts/data/higgs-sim.ts
const N_BKG = FAST ? 3_000 : 100_000;
const N_SIG_GG = FAST ? 500 : 6_000;
const N_SIG_4L = FAST ? 300 : 6_000;
const K_H = 3.4; // applied later, in the analysis: the ratio of the higher-order to the leading-order gg → H cross-section, roughly
const cfg = presets['cms-like'];
const menu = menuFromSettings('chapter-27 suggested menu', suggestedSettings());
const machine = machineStage({ beamEnergyGeV: SQRT_S / 2 });

const q = (x: number, scale: number) => Math.max(-32768, Math.min(32767, Math.round(x * scale)));
const etaOf = (p: { px: number; py: number; pz: number }) => Math.asinh(p.pz / Math.hypot(p.px, p.py));
const phiOf = (p: { px: number; py: number }) => Math.atan2(p.py, p.px);
const ptOf = (p: { px: number; py: number }) => Math.hypot(p.px, p.py);

function trigger(reco: ReturnType<typeof reconstruct>, det: ReturnType<typeof simulate>): boolean {
  const d = evaluateMenu([{ reco, detector: det }], menu)[0]!;
  return d.hltPassed.length > 0;
}
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const t0 = Date.now();
const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)} s] ${s}`);

// ── γγ ──────────────────────────────────────────────────────────────────────────────────────────
function diphotonSample() {
  const records: number[] = [];
  const stats = { signal: { generated: 0, twoPhotons: 0, triggered: 0 }, background: { generated: 0, twoPhotons: 0, triggered: 0 } };
  // signal
  const sigProc = getProcess('pp->H->gammagamma');
  const sigmaSigPb = sigProc.sigma(SQRT_S);
  const rs = rng(2012);
  const run = (proc: Process | string, n: number, r: ReturnType<typeof rng>, signal: boolean) => {
    const s = signal ? stats.signal : stats.background;
    for (let i = 0; i < n; i++) {
      const truth = generate(proc, { sqrtS: SQRT_S }, r);
      const det = simulate(truth, cfg, r);
      const reco = reconstruct(det, cfg, {}, truth);
      s.generated++;
      const ph = reco.objects.filter((o) => o.kind === 'photon').sort((a, b) => ptOf(b.p) - ptOf(a.p));
      if (ph.length < 2) continue;
      s.twoPhotons++;
      const trig = trigger(reco, det);
      if (trig) s.triggered++;
      records.push((signal ? 1 : 0) | (trig ? 2 : 0));
      for (const o of ph.slice(0, 2)) records.push(q(ptOf(o.p), 40), q(etaOf(o.p), 4000), q(phiOf(o.p), 4000), q(o.isolation ?? 0, 2000), q(o.caloIsolation ?? 0, 2000));
      if ((s.generated % 10000) === 0) log(`${signal ? 'signal' : 'background'} ${s.generated}`);
    }
  };
  run(sigProc, N_SIG_GG, rs, true);
  log(`γγ signal done: ${stats.signal.twoPhotons} with two photons of ${stats.signal.generated}`);
  // continuum, filtered at the hard-process level so that the pool is spent where the analysis looks
  const base = diphoton({ ptMin: 24 });
  let tried = 0, accepted = 0;
  const hardMass = (ev: { particles: { pdg: number; status: string; p: { E: number; px: number; py: number; pz: number } }[] }) => {
    const ph = ev.particles.filter((p) => p.pdg === 22 && p.status === 'final');
    if (ph.length < 2) return null;
    const a = ph[0]!.p, b = ph[1]!.p;
    const E = a.E + b.E, px = a.px + b.px, py = a.py + b.py, pz = a.pz + b.pz;
    return { m: Math.sqrt(Math.max(0, E * E - px * px - py * py - pz * pz)), pt: Math.min(ptOf(a), ptOf(b)) };
  };
  const filtered: Process = {
    ...base,
    generate(r, c) {
      for (;;) {
        tried++;
        const o = base.generate(r, c);
        const k = hardMass(o.event);
        if (k && k.m > 95 && k.m < 175 && k.pt > 0.25 * k.m - 3) { accepted++; return o; }
      }
    },
  };
  const rb = rng(8000);
  run(filtered, N_BKG, rb, false);
  const sigmaFilteredPb = (base.sigma(SQRT_S) * accepted) / tried;
  log(`γγ continuum done: σ_filtered = ${sigmaFilteredPb.toFixed(3)} pb, ${stats.background.twoPhotons} with two photons of ${stats.background.generated}`);
  const buf = Buffer.from(new Int16Array(records).buffer);
  writeFileSync(path.join(out, 'higgs-gamgam-sim.bin'), buf);
  const lumiPoolFb = N_BKG / sigmaFilteredPb / 1000;
  const manifest = {
    file: 'higgs-gamgam-sim.bin',
    kind: 'SIMULATION, not real data',
    format: 'little-endian Int16, 11 values per stored event: flags, then for each of the two hardest reconstructed photons pT*40, eta*4000, phi*4000, isoTrack*2000, isoCalo*2000. flags: bit0 signal event, bit1 passed the trigger menu.',
    events: records.length / 11,
    sha256: sha(buf),
    machine: { sqrtS_GeV: SQRT_S, mode: 'pp', pileup: 0, crossingRateHz: machine.crossingRateHz },
    generator: 'hep/gen: pp->H->gammagamma (gg -> H effective vertex, LO) and pp->gammagamma (LO qqbar and gg box, pT > 24 GeV) with the parton shower and toy hadronisation',
    detector: 'hep/detector preset cms-like; hep/reco default configuration',
    trigger: 'hep/trigger menuFromSettings(suggestedSettings()): the menu of the Chapter 27 game; flag = any item passes Level 1 and the HLT selection',
    samples: {
      signal: { process: 'pp->H->gammagamma', mH_GeV: 125.2, sigmaLO_pb: sigmaSigPb, kFactorToApply: K_H, ...stats.signal },
      background: {
        process: 'pp->gammagamma, ptMin 24 GeV, truth diphoton mass 95-175 GeV, pT > m/4 - 3 GeV',
        sigmaFiltered_pb: sigmaFilteredPb, generated: stats.background.generated, twoPhotons: stats.background.twoPhotons, triggered: stats.background.triggered,
        poolLuminosity_fb: lumiPoolFb, hardEventsTried: tried, hardEventsAccepted: accepted,
      },
    },
    notModelled: 'photon-like jets (the reducible background), pile-up, the underlying event beyond the toy model, higher-order corrections to the continuum (no K factor), detector effects beyond the fast simulation',
    seeds: { signal: 2012, background: 8000 },
    script: 'scripts/data/higgs-sim.ts',
    prepared: new Date().toISOString().slice(0, 10),
    licence: 'Generated by the course; CC0.',
  };
  writeFileSync(path.join(out, 'higgs-gamgam-sim.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

// ── 4ℓ ──────────────────────────────────────────────────────────────────────────────────────────
function fourLeptonSample() {
  const proc = getProcess('pp->H->ZZ->4l');
  const sigma = proc.sigma(SQRT_S);
  const r = rng(125);
  const records: number[] = [];
  const stats = { generated: 0, fourLeptons: 0, triggered: 0 };
  for (let i = 0; i < N_SIG_4L; i++) {
    const truth = generate(proc, { sqrtS: SQRT_S }, r);
    const det = simulate(truth, cfg, r);
    const reco = reconstruct(det, cfg, {}, truth);
    stats.generated++;
    const lep = reco.objects.filter((o) => o.kind === 'electron' || o.kind === 'muon').sort((a, b) => ptOf(b.p) - ptOf(a.p));
    if (lep.length < 4) continue;
    stats.fourLeptons++;
    const trig = trigger(reco, det);
    if (trig) stats.triggered++;
    records.push(1 | (trig ? 2 : 0));
    for (const o of lep.slice(0, 4)) {
      const code = (o.kind === 'muon' ? 13 : 11) * ((o.charge ?? -1) < 0 ? 1 : -1);
      records.push(code, q(ptOf(o.p), 40), q(etaOf(o.p), 4000), q(phiOf(o.p), 4000), q(Math.max(o.isolation ?? 0, o.caloIsolation ?? 0), 2000));
    }
  }
  log(`4ℓ signal done: ${stats.fourLeptons} with four leptons of ${stats.generated}`);
  const buf = Buffer.from(new Int16Array(records).buffer);
  writeFileSync(path.join(out, 'higgs-4l-sim.bin'), buf);
  const manifest = {
    file: 'higgs-4l-sim.bin',
    kind: 'SIMULATION, not real data',
    format: 'little-endian Int16, 21 values per stored event: flags (bit0 signal, bit1 passed the trigger menu), then for each of the four hardest reconstructed electrons or muons: PDG code (+-11, +-13), pT*40, eta*4000, phi*4000, isolation*2000 (the larger of the track and calorimeter values).',
    events: records.length / 21,
    sha256: sha(buf),
    machine: { sqrtS_GeV: SQRT_S, mode: 'pp', pileup: 0 },
    generator: 'hep/gen: pp->H->ZZ->4l (gg -> H effective vertex at LO, H -> ZZ* with the off-shell Z* mass distribution and spin correlations, Z -> e+e-, mu+mu-), parton shower and toy hadronisation',
    detector: 'hep/detector preset cms-like; hep/reco default configuration',
    trigger: 'hep/trigger menuFromSettings(suggestedSettings())',
    sample: { process: 'pp->H->ZZ->4l', mH_GeV: 125.2, sigmaLO_pb: sigma, kFactorToApply: K_H, ...stats },
    notModelled: 'the ZZ* and other backgrounds (the generator has no qqbar -> ZZ process: the backgrounds in Chapter 29 come from the CMS open-data notebook), pile-up, interference between identical leptons',
    seed: 125,
    script: 'scripts/data/higgs-sim.ts',
    prepared: new Date().toISOString().slice(0, 10),
    licence: 'Generated by the course; CC0.',
  };
  writeFileSync(path.join(out, 'higgs-4l-sim.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

void pairMass;
fourLeptonSample();
diphotonSample();
log('done');
