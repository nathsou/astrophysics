<!--
  W → ℓν at a hadron collider (Chapter 23): the lepton's transverse momentum, the missing transverse momentum and the transverse mass.
  Events come from the course generator (`hep/gen`, truth level with parton shower), seeded and generated in chunks in the browser.
  The missing transverse momentum is minus the vector sum of every visible final-state particle (through the hook `reco.missingPt`,
  so the reader's function from Chapter 23 is used if installed) plus a Gaussian smearing of each component, a stand-in for the
  detector's resolution on the hadronic recoil. The transverse mass goes through the hook `kinematics.transverseMass`.

    ::w-transverse{n="23.3" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import HepHist from '$lib/charts/HepHist.svelte';
  import { generate } from '$lib/hep/gen';
  import { rng, normal } from '$lib/hep/random';
  import { hook } from '$lib/hep/hooks';
  import { transverseMass, pt as ptOf, type P4 } from '$lib/hep/kinematics';
  import { missingPt } from '$lib/hep/reco';
  import { M_W } from '$lib/hep/sm';
  import { applyMine, listMine } from '$lib/code/apply';
  import { jacobianDensity } from './electroweak';

  let { n, caption, title = 'The W at a hadron collider' }: { n?: string | number; caption?: string; title?: string } = $props();

  type Coll = 'sppbar' | 'lhc';
  let coll = $state<Coll>('sppbar');
  let smear = $state(3);
  let seed = $state(5);
  const TARGET = 4000;

  interface Ev {
    lep: P4;
    visible: P4[];
    gx: number;
    gy: number;
  }
  let events = $state.raw<Ev[]>([]);
  let progress = $state(0);
  let mine = $state<{ hook: string; exercise: string; enabled: boolean }[]>([]);
  let useMine = $state(true);
  let token = 0;

  onMount(() => {
    mine = listMine().filter((m) => m.hook === 'reco.missingPt' || m.hook === 'kinematics.transverseMass');
  });

  $effect(() => {
    const c = coll, s = seed;
    const my = ++token;
    const r = rng(s);
    const proc = c === 'sppbar' ? 'ppbar->W->munu' : 'pp->W->munu';
    const sqrtS = c === 'sppbar' ? 540 : 13000;
    const out: Ev[] = [];
    events = [];
    progress = 0;
    const step = () => {
      if (my !== token) return;
      for (let i = 0; i < 250 && out.length < TARGET; i++) {
        const ev = generate(proc, { sqrtS }, r);
        let lep: P4 | null = null;
        const visible: P4[] = [];
        for (const p of ev.particles) {
          if (p.status !== 'final') continue;
          const a = Math.abs(p.pdg);
          if (a === 12 || a === 14 || a === 16) continue;
          visible.push(p.p);
          if (a === 13) lep = p.p;
        }
        if (lep) out.push({ lep, visible, gx: normal(r, 0, 1), gy: normal(r, 0, 1) });
      }
      progress = out.length;
      events = out.slice();
      if (out.length < TARGET) setTimeout(step, 0);
    };
    setTimeout(step, 0);
    return () => {
      token++;
    };
  });

  const note = $derived.by(() => {
    if (useMine && mine.some((m) => m.enabled)) {
      const a = applyMine();
      const used = ['reco.missingPt', 'kinematics.transverseMass'].filter((h) => a.active.includes(h)).map((h) => h.split('.')[1]);
      const errs = Object.entries(a.errors).map(([k, v]) => `${k}: ${v}`);
      return errs.length ? `Your code failed to load (${errs.join('; ')}); the library's is used.` : `Computed with your code for ${used.join(' and ')}; the library's for the rest.`;
    }
    applyMine();
    return 'Computed with the library.';
  });

  const computed = $derived.by(() => {
    void note;
    const mp = hook('reco.missingPt', missingPt);
    const mt = hook('kinematics.transverseMass', transverseMass);
    const NB = 70, NM = 80;
    const hp = new Array<number>(NB).fill(0), hm = new Array<number>(NB).fill(0), ht = new Array<number>(NM).fill(0);
    for (const e of events) {
      const m = mp(e.visible);
      const met = { x: m.x + smear * e.gx, y: m.y + smear * e.gy };
      const pl = ptOf(e.lep);
      const b1 = Math.floor(pl);
      if (b1 >= 0 && b1 < NB) hp[b1]!++;
      const b2 = Math.floor(Math.hypot(met.x, met.y));
      if (b2 >= 0 && b2 < NB) hm[b2]!++;
      const t = mt(e.lep, met);
      const b3 = Math.floor(t * 0.75);
      if (Number.isFinite(t) && b3 >= 0 && b3 < NM) ht[b3]!++;
    }
    return { hp, hm, ht };
  });
  const edges = (nb: number, w: number) => Array.from({ length: nb + 1 }, (_, i) => i * w);
  const ptEdges = edges(70, 1), mtEdges = edges(80, 4 / 3);
  const N = $derived(events.length);
  const jac = $derived(ptEdges.slice(0, -1).map((x0, i) => {
    // expected counts from the analytic density (W at rest), by the midpoint rule over the bin
    let s = 0;
    for (let k = 0; k < 10; k++) s += jacobianDensity(x0 + (k + 0.5) / 10, M_W) / 10;
    return s * N;
  }));
  const ymaxPt = $derived(Math.max(10, ...computed.hp, ...computed.hm) * 1.15);
  const ymaxMt = $derived(Math.max(10, ...computed.ht) * 1.15);
  const above = $derived(N ? computed.ht.slice(Math.ceil((M_W + 6) * 0.75)).reduce((a, b) => a + b, 0) / N : 0);
</script>

<Widget {title} {n} {caption} kind="Simulation" onreset={() => { coll = 'sppbar'; smear = 3; seed = 5; }}>
  {#snippet controls()}
    <div class="ctl">
      <Segmented label="Collider" size="sm" bind:value={coll} options={[{ value: 'sppbar', label: 'SppS: p p̄ at 540 GeV' }, { value: 'lhc', label: 'LHC: pp at 13 TeV' }]} />
      <Slider bind:value={smear} min={0} max={15} step={0.5} label="Recoil resolution, per component [GeV]" format={(v) => v.toFixed(1)} />
      {#if mine.length}<label class="ui chk"><input type="checkbox" bind:checked={useMine} /> use my code</label>{/if}
      <Button size="sm" onclick={() => (seed = seed + 1)}>New events (seed {seed})</Button>
    </div>
  {/snippet}
  <div class="grid">
    <div>
      <h5 class="ui">Lepton p<sub>T</sub> and missing p<sub>T</sub></h5>
      <HepHist
        label="Histograms of the muon's transverse momentum and of the missing transverse momentum in simulated W to muon neutrino events"
        series={[
          { edges: ptEdges, counts: computed.hp, label: 'muon pT', color: 'var(--p-muon)' },
          { edges: ptEdges, counts: computed.hm, label: 'missing pT', color: 'var(--p-neutrino)' },
          { edges: ptEdges, counts: jac, label: 'W at rest (analytic): the Jacobian peak', color: 'var(--ink-3)', points: true },
        ]}
        x={{ domain: [0, 70], label: 'transverse momentum [GeV]' }}
        y={{ domain: [0, ymaxPt], label: 'events per GeV' }}
        markers={[{ x: M_W / 2, label: 'm_W/2', at: 0.95 }]}
        height={250}
      />
    </div>
    <div>
      <h5 class="ui">Transverse mass</h5>
      <HepHist
        label="Histogram of the transverse mass of the muon and the missing transverse momentum in simulated W events, with an edge at the W mass"
        series={[{ edges: mtEdges, counts: computed.ht, label: 'm_T', color: 'var(--series-1)' }]}
        x={{ domain: [0, 106.7], label: 'transverse mass m_T [GeV]' }}
        y={{ domain: [0, ymaxMt], label: 'events per 1.33 GeV' }}
        markers={[{ x: M_W, label: 'm_W', at: 0.95 }]}
        height={250}
      />
    </div>
  </div>
  <p class="ui out" aria-live="polite">
    {N.toLocaleString('en-GB')} of {TARGET.toLocaleString('en-GB')} events{progress < TARGET ? ' (generating…)' : ''}. {(100 * above).toFixed(1)} % of the events have m<sub>T</sub> more than 6 GeV above m<sub>W</sub>: the W's own width and the smearing of the recoil. {note}
  </p>
</Widget>

<style>
  .ctl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
    align-items: end;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
  }
  @media (max-width: 860px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  h5 {
    margin: 0 0 0.3rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
  }
  .out {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
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
