<!--
  Reconstructing tt̄ → ℓ+jets (Chapter 25 flagship). 591 simulated events (hep/gen with shower and hadronisation, the onion detector, hep/reco with particle flow, anti-kT jets and
  b-tagging) that pass a lepton + jets selection (`topSample.ts`, made by `makeTopSample.ts`). In each event the jets must be assigned to the four quarks of the decay. The histogram
  shows the mass of the three-jet system assigned to the hadronic top quark, four ways: every three-jet combination; the best χ² assignment; the best χ² assignment with a
  b-tag penalty; and the correct assignment (known from the generator's truth, possible only in simulation). The χ² assignment is `assignTopJets` of `hep/topreco`
  through the hook `reco.assignTopJets`: if the reader's function from Chapter 25 is installed ("use my code"), it is the one used.

    ::top-reconstruction{n="25.2" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import HepHist from '$lib/charts/HepHist.svelte';
  import { fromPtEtaPhiM, mass, add, type P4 } from '$lib/hep/kinematics';
  import { assignTopJets, assignmentCount, TOP_CHI2, type TopJet, type Assignment } from '$lib/hep/topreco';
  import { applyMine, listMine } from '$lib/code/apply';
  import { TOP_SAMPLE } from './topSample';

  let { n, caption, title = 'Reconstructing top quark pairs' }: { n?: string | number; caption?: string; title?: string } = $props();

  let maxJets = $state(6);
  let ptMin = $state(25);
  let penalty = $state(10);
  let evIndex = $state(3);
  let method = $state<'chi2' | 'tag'>('tag');
  let showAll = $state(true), showChi = $state(true), showTag = $state(true), showTruth = $state(true);
  let mine = $state<{ hook: string; exercise: string; enabled: boolean }[]>([]);
  let useMine = $state(true);
  onMount(() => {
    mine = listMine().filter((m) => m.hook === 'reco.assignTopJets');
  });
  const note = $derived.by(() => {
    if (useMine && mine.some((m) => m.enabled)) {
      const a = applyMine();
      const err = a.errors['reco.assignTopJets'];
      return err ? `Your code failed to load (${err}); the library's is used.` : a.active.includes('reco.assignTopJets') ? 'The χ² assignment is computed with your code.' : 'The χ² assignment is computed with the library.';
    }
    applyMine();
    return 'The χ² assignment is computed with the library.';
  });

  interface Ev {
    lep: P4;
    met: { x: number; y: number };
    jets: TopJet[];
    raw: number[][];
  }
  const all: Ev[] = TOP_SAMPLE.events.map((e) => ({
    lep: fromPtEtaPhiM(e.l[0]!, e.l[1]!, e.l[2]!, 0),
    met: { x: e.m[0]!, y: e.m[1]! },
    jets: e.j.map((j) => ({ p: fromPtEtaPhiM(j[0]!, j[1]!, j[2]!, j[3]!), btag: j[4]! })),
    raw: e.j,
  }));
  const events = $derived(
    all
      .map((e) => {
        const keep = e.raw.map((j, i) => (j[0]! >= ptMin ? i : -1)).filter((i) => i >= 0);
        return { ...e, jets: keep.map((i) => e.jets[i]!), raw: keep.map((i) => e.raw[i]!) };
      })
      .filter((e) => e.jets.length >= 4),
  );

  const NB = 40, LO = 0, HI = 400;
  const edges = Array.from({ length: NB + 1 }, (_, i) => LO + ((HI - LO) * i) / NB);
  const bin = (m: number) => Math.floor(((m - LO) / (HI - LO)) * NB);

  const result = $derived.by(() => {
    void note;
    const hAll = new Array<number>(NB).fill(0), hChi = new Array<number>(NB).fill(0), hTag = new Array<number>(NB).fill(0), hTruth = new Array<number>(NB).fill(0);
    let nAll = 0, okChi = 0, okTag = 0, nTruth = 0, peakChi = 0, peakTag = 0;
    const assigns: { chi: Assignment | null; tag: Assignment | null }[] = [];
    for (const e of events) {
      const nj = Math.min(maxJets, e.jets.length);
      const w = 6 / (nj * (nj - 1) * (nj - 2));
      for (let a = 0; a < nj; a++) for (let b = a + 1; b < nj; b++) for (let c = b + 1; c < nj; c++) {
        const m = mass(add(add(e.jets[a]!.p, e.jets[b]!.p), e.jets[c]!.p));
        const k = bin(m);
        if (k >= 0 && k < NB) hAll[k]! += w;
      }
      const chi = assignTopJets(e.jets, e.lep, e.met, { maxJets, btagPenalty: 0 });
      const tag = assignTopJets(e.jets, e.lep, e.met, { maxJets, btagPenalty: penalty });
      assigns.push({ chi, tag });
      nAll++;
      for (const [a, h] of [[chi, hChi], [tag, hTag]] as const) {
        if (!a) continue;
        const k = bin(a.mTopHad);
        if (k >= 0 && k < NB) h[k]!++;
      }
      const roles = e.raw.slice(0, nj).map((j) => j[5]!);
      const ib = roles.indexOf(2), iq = roles.map((r, i) => (r === 3 ? i : -1)).filter((i) => i >= 0), il = roles.indexOf(1);
      const complete = ib >= 0 && iq.length === 2 && il >= 0;
      const right = (a: Assignment | null) => !!a && roles[a.bLep] === 1 && roles[a.bHad] === 2 && roles[a.q1] === 3 && roles[a.q2] === 3;
      if (complete) {
        nTruth++;
        if (right(chi)) okChi++;
        if (right(tag)) okTag++;
        const m = mass(add(add(e.jets[iq[0]!]!.p, e.jets[iq[1]!]!.p), e.jets[ib]!.p));
        const k = bin(m);
        if (k >= 0 && k < NB) hTruth[k]!++;
      }
      if (chi && Math.abs(chi.mTopHad - TOP_CHI2.mT) < 30) peakChi++;
      if (tag && Math.abs(tag.mTopHad - TOP_CHI2.mT) < 30) peakTag++;
    }
    return { hAll, hChi, hTag, hTruth, nAll, okChi, okTag, nTruth, peakChi, peakTag, assigns };
  });

  const ymax = $derived(Math.max(5, ...result.hChi, ...result.hTag, ...result.hTruth, ...(showAll ? result.hAll : [0])) * 1.12);
  const idx = $derived(Math.min(evIndex, Math.max(0, events.length - 1)));
  const ev = $derived(events[idx]);
  const asg = $derived(result.assigns[idx]?.[method === 'tag' ? 'tag' : 'chi'] ?? null);
  const nj = $derived(Math.min(maxJets, ev?.jets.length ?? 0));
  const combos = $derived(assignmentCount(nj));
  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(0)} %` : '—');

  // η–φ display
  const WD = 340, HD = 200;
  const ex = (eta: number) => 20 + ((eta + 2.6) / 5.2) * (WD - 40);
  const ey = (phi: number) => 14 + ((Math.PI - phi) / (2 * Math.PI)) * (HD - 28);
  const roleName = (i: number): string => (!asg ? '' : i === asg.bLep ? 'b(ℓ)' : i === asg.bHad ? 'b(h)' : i === asg.q1 || i === asg.q2 ? 'q' : '');
  const truthRole = (i: number): number => ev?.raw[i]?.[5] ?? 0;
  const jetEta = (p: P4) => Math.asinh(p.pz / Math.hypot(p.px, p.py));
  const jetPhi = (p: P4) => Math.atan2(p.py, p.px);
</script>

<Widget {title} {n} {caption} kind="Simulation" onreset={() => { maxJets = 6; ptMin = 25; penalty = 10; evIndex = 3; method = 'tag'; showAll = showChi = showTag = showTruth = true; }}>
  {#snippet controls()}
    <div class="ctl">
      <Slider bind:value={maxJets} min={4} max={8} step={1} label="Leading jets considered" format={(v) => v.toFixed(0)} />
      <Slider bind:value={ptMin} min={25} max={60} step={1} label="Jet pT threshold, GeV" format={(v) => v.toFixed(0)} />
      <Slider bind:value={penalty} min={0} max={40} step={1} label="b-tag penalty added to χ² per mismatch" format={(v) => v.toFixed(0)} />
      {#if mine.length}<label class="ui chk"><input type="checkbox" bind:checked={useMine} /> use my code</label>{/if}
      <div class="tog">
        <Toggle bind:checked={showAll} label="Every combination" />
        <Toggle bind:checked={showChi} label="Best χ²" />
        <Toggle bind:checked={showTag} label="Best χ² with b-tag" />
        <Toggle bind:checked={showTruth} label="Correct (truth)" />
      </div>
    </div>
  {/snippet}
  <div class="grid">
    <div>
      <h5 class="ui">Mass of the three jets assigned to the hadronic top</h5>
      <HepHist
        label="Histogram of the three-jet mass assigned to the hadronic top quark in simulated tt̄ events: all combinations, the best chi-squared assignment, the best with b-tagging, and the correct one"
        series={[
          ...(showAll ? [{ edges, counts: result.hAll, label: 'a random three-jet combination (each event counted once)', color: 'var(--series-8)', fill: true } as const] : []),
          ...(showChi ? [{ edges, counts: result.hChi, label: 'best χ²', color: 'var(--series-2)', errors: false } as const] : []),
          ...(showTag ? [{ edges, counts: result.hTag, label: 'best χ² with b-tag penalty', color: 'var(--series-1)', errors: false } as const] : []),
          ...(showTruth ? [{ edges, counts: result.hTruth, label: 'correct jets (truth: simulation only)', color: 'var(--ok)', errors: false } as const] : []),
        ]}
        x={{ domain: [LO, HI], label: 'm(jjb) [GeV]' }}
        y={{ domain: [0, ymax], label: 'events per 10 GeV' }}
        markers={[{ x: TOP_CHI2.mT, label: 'm_t', at: 0.95 }]}
        height={290}
      />
      <table class="ui tab" aria-live="polite">
        <thead><tr><th></th><th>Correct assignment</th><th>Within 30 GeV of 172.5</th></tr></thead>
        <tbody>
          <tr><th scope="row">Best χ²</th><td>{pct(result.okChi, result.nTruth)} of the {result.nTruth} events whose four quark jets are all among the jets used</td><td>{pct(result.peakChi, result.nAll)}</td></tr>
          <tr><th scope="row">Best χ² with b-tag penalty</th><td>{pct(result.okTag, result.nTruth)}</td><td>{pct(result.peakTag, result.nAll)}</td></tr>
        </tbody>
      </table>
      <p class="ui sub">{result.nAll} of {TOP_SAMPLE.selected} selected events have at least four jets above {ptMin} GeV. Of {TOP_SAMPLE.generated.toLocaleString('en-GB')} generated tt̄ → ℓ+jets events, {TOP_SAMPLE.selected} passed the selection ({(100 * TOP_SAMPLE.selected / TOP_SAMPLE.generated).toFixed(0)} %). {note}</p>
    </div>
    <div>
      <h5 class="ui">One event ({idx + 1} of {events.length})</h5>
      <div class="nav ui">
        <button onclick={() => (evIndex = Math.max(0, idx - 1))} aria-label="Previous event">‹</button>
        <input type="range" min="0" max={Math.max(0, events.length - 1)} bind:value={evIndex} aria-label="Event number" />
        <button onclick={() => (evIndex = Math.min(events.length - 1, idx + 1))} aria-label="Next event">›</button>
        <button class:on={method === 'chi2'} onclick={() => (method = 'chi2')}>χ²</button>
        <button class:on={method === 'tag'} onclick={() => (method = 'tag')}>χ² + b-tag</button>
      </div>
      {#if ev}
        <svg viewBox="0 0 {WD} {HD}" role="img" aria-label="The jets of one event in the η–φ plane, with the lepton and the roles assigned by the chosen method">
          <rect x="20" y="14" width={WD - 40} height={HD - 28} class="frame" />
          <text x={WD - 20} y={HD - 2} text-anchor="end" class="tick">η −2.5 … 2.5</text>
          <text x="22" y="10" class="tick">φ</text>
          {#each ev.jets.slice(0, nj) as j, i}
            {@const r = 4 + 0.9 * Math.sqrt(Math.hypot(j.p.px, j.p.py))}
            {@const tr = truthRole(i)}
            <circle cx={ex(jetEta(j.p))} cy={ey(jetPhi(j.p))} r={r} fill={j.btag > 0.5 ? 'var(--series-1)' : 'var(--series-8)'} fill-opacity="0.35" stroke={tr ? 'var(--ok)' : 'var(--ink-3)'} stroke-width={tr ? 3 : 1} />
            <text x={ex(jetEta(j.p))} y={ey(jetPhi(j.p)) + 4} text-anchor="middle" class="role">{roleName(i)}</text>
          {/each}
          {#each ev.jets.slice(nj) as j}
            <circle cx={ex(jetEta(j.p))} cy={ey(jetPhi(j.p))} r={3 + 0.6 * Math.sqrt(Math.hypot(j.p.px, j.p.py))} fill="none" stroke="var(--ink-3)" stroke-dasharray="2 2" />
          {/each}
          <rect x={ex(jetEta(ev.lep)) - 5} y={ey(jetPhi(ev.lep)) - 5} width="10" height="10" fill="var(--p-muon)" />
          <text x={ex(jetEta(ev.lep)) + 8} y={ey(jetPhi(ev.lep)) + 4} class="role">ℓ</text>
          {#if true}
            {@const mphi = Math.atan2(ev.met.y, ev.met.x)}
            {@const mm = Math.hypot(ev.met.x, ev.met.y)}
            <line x1="20" y1={ey(mphi)} x2="46" y2={ey(mphi)} stroke="var(--p-neutrino)" stroke-width="3" />
            <line x1={WD - 20} y1={ey(mphi)} x2={WD - 46} y2={ey(mphi)} stroke="var(--p-neutrino)" stroke-width="3" />
          {/if}
        </svg>
        <p class="ui sub">
          {nj} jets used: {combos} possible assignments (4 jets: 12; 6 jets: 180). Blue-filled jets are b-tagged. A green outline marks a jet that the generator's truth links to one of the four quarks. The marks on both edges give the φ of the missing transverse momentum ({Math.hypot(ev.met.x, ev.met.y).toFixed(0)} GeV).
          {#if asg}Chosen: b(ℓ) = jet {asg.bLep + 1}, b(h) = jet {asg.bHad + 1}, q = jets {asg.q1 + 1} and {asg.q2 + 1}; χ² = {asg.chi2.toFixed(1)}, m(jj) = {asg.mW.toFixed(0)}, m(jjb) = {asg.mTopHad.toFixed(0)}, m(ℓνb) = {asg.mTopLep.toFixed(0)} GeV.{/if}
        </p>
      {/if}
    </div>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
    align-items: end;
  }
  .tog {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.2rem;
    width: 100%;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    gap: 1.2rem;
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  h5 {
    margin: 0 0 0.4rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
  }
  svg {
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    display: block;
  }
  .frame {
    fill: none;
    stroke: var(--line-strong);
  }
  .tick {
    font-size: 9.5px;
    fill: var(--ink-3);
    font-family: var(--font-ui);
  }
  .role {
    font-size: 10px;
    fill: var(--ink);
    font-family: var(--font-ui);
    paint-order: stroke;
    stroke: var(--panel);
    stroke-width: 3px;
  }
  .nav {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin-bottom: 0.4rem;
  }
  .nav input {
    flex: 1;
    min-width: 0;
  }
  .nav button {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.15rem 0.55rem;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .nav button.on {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  .tab {
    border-collapse: collapse;
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }
  .tab th,
  .tab td {
    padding: 0.15rem 1rem 0.15rem 0;
    text-align: left;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    color: var(--ink-2);
  }
  .tab td {
    color: var(--fg);
    font-family: var(--font-mono);
  }
  .sub {
    margin: 0.4rem 0 0;
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
  .chk {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.8rem;
  }
</style>
