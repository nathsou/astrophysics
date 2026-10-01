/**
 * Makes (part of) `topSample.ts`: tt̄ → ℓ+jets events from the whole course pipeline (generator with shower and hadronisation, the `onion` detector
 * simulation, reconstruction with particle flow, anti-kT jets and b-tagging), kept if they pass the lepton + jets selection of `hep/topreco`.
 * Each kept event stores the lepton, the missing momentum and the selected jets with the b-tag score and, from the truth record, which of the four
 * hard partons (b of the leptonic top, b of the hadronic top, the two quarks of the W) each jet is closest to (ΔR < 0.4, each parton used once).
 *
 *     node --experimental-strip-types src/lib/sims/part6/makeTopSample.ts <seed> <generated> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { rng } from '../../hep/random/index.ts';
import { generate } from '../../hep/gen/index.ts';
import { presets, simulate } from '../../hep/detector/index.ts';
import { reconstruct } from '../../hep/reco/index.ts';
import { selectLeptonJets } from '../../hep/topreco/index.ts';
import { deltaPhi } from '../../hep/kinematics/index.ts';

const [seedArg, nArg, out] = process.argv.slice(2);
const seed = Number(seedArg), n = Number(nArg);
const r = rng(seed);
const cfg = presets.onion!;
const pt = (p: { px: number; py: number }) => Math.hypot(p.px, p.py);
const eta = (p: { px: number; py: number; pz: number }) => Math.asinh(p.pz / pt(p));
const phi = (p: { px: number; py: number }) => Math.atan2(p.py, p.px);
const rd = (x: number, d: number) => Number(x.toFixed(d));

const events: unknown[] = [];
let selected = 0;
for (let i = 0; i < n; i++) {
  const truth = generate('pp->ttbar->leptonjets', { sqrtS: 13000 }, r);
  const det = simulate(truth, cfg, r.fork('sim' + i));
  const reco = reconstruct(det, cfg, {}, truth);
  const sel = selectLeptonJets(reco.objects, reco.met);
  if (!sel) continue;
  // the four hard partons: b quarks from the two tops, and the quarks of the hadronic W
  const ps = truth.particles;
  const lep = ps.find((p) => p.status === 'final' && [11, 13].includes(Math.abs(p.pdg)) && Math.abs(ps[p.mothers[0]!]!.pdg) === 24 && ps[ps[p.mothers[0]!]!.mothers[0]!]!.pdg !== undefined);
  if (!lep) continue;
  const tLep = ps[ps[lep.mothers[0]!]!.mothers[0]!]!;
  const bLep = ps.find((p) => Math.abs(p.pdg) === 5 && p.mothers[0] === tLep.id)!;
  const tHad = ps.find((p) => Math.abs(p.pdg) === 6 && p.id !== tLep.id)!;
  const bHad = ps.find((p) => Math.abs(p.pdg) === 5 && p.mothers[0] === tHad.id)!;
  const wHad = ps.find((p) => Math.abs(p.pdg) === 24 && p.mothers[0] === tHad.id)!;
  const qs = ps.filter((p) => p.mothers[0] === wHad.id);
  const targets = [{ role: 1, p: bLep.p }, { role: 2, p: bHad.p }, { role: 3, p: qs[0]!.p }, { role: 3, p: qs[1]!.p }];
  const role = new Array<number>(sel.jets.length).fill(0);
  const pairs: { d: number; t: number; j: number }[] = [];
  targets.forEach((t, ti) => sel.jets.forEach((j, ji) => {
    const d = Math.hypot(eta(t.p) - eta(j.p), deltaPhi(phi(t.p), phi(j.p)));
    if (d < 0.4) pairs.push({ d, t: ti, j: ji });
  }));
  pairs.sort((a, b) => a.d - b.d);
  const usedT = new Set<number>(), usedJ = new Set<number>();
  for (const pr of pairs) {
    if (usedT.has(pr.t) || usedJ.has(pr.j)) continue;
    usedT.add(pr.t);
    usedJ.add(pr.j);
    role[pr.j] = targets[pr.t]!.role;
  }
  selected++;
  events.push({
    l: [rd(pt(sel.lepton), 2), rd(eta(sel.lepton), 3), rd(phi(sel.lepton), 3), sel.charge, sel.kind === 'muon' ? 1 : 0],
    m: [rd(sel.met.x, 2), rd(sel.met.y, 2)],
    j: sel.jets.map((j, k) => [rd(pt(j.p), 2), rd(eta(j.p), 3), rd(phi(j.p), 3), rd(Math.sqrt(Math.max(0, j.p.E ** 2 - j.p.px ** 2 - j.p.py ** 2 - j.p.pz ** 2)), 2), rd(j.btag, 3), role[k]]),
  });
}
writeFileSync(out!, JSON.stringify({ seed, generated: n, selected, events }));
console.log(`seed ${seed}: generated ${n}, selected ${selected}`);
