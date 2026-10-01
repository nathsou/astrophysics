<!--
  b-tagging on simulated jets (Chapter 24). Light, charm and bottom jets (30–80 GeV) were run through the course's detector simulation and reconstruction (`makeIpSample.ts`);
  the figure shows the b-tag score of the reference tagger or the lifetime-signed impact-parameter significances of the tracks, and what a cut does to the three flavours.
  With "use my code" installed (Chapter 24's two exercises), a button re-runs 150 jets of each flavour through the pipeline in the browser, with your impact-parameter
  and b-tag functions, and shows their scores alongside.

    ::btag-lab{n="24.5" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import HepHist from '$lib/charts/HepHist.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { rng } from '$lib/hep/random';
  import { presets, simulate } from '$lib/hep/detector';
  import { reconstruct, synthetic } from '$lib/hep/reco';
  import { fromPtEtaPhiM, deltaR } from '$lib/hep/kinematics';
  import { applyMine, listMine } from '$lib/code/apply';
  import { IP_SAMPLE } from './ipSample';

  let { n, caption, title = 'Telling b jets from light jets' }: { n?: string | number; caption?: string; title?: string } = $props();

  type Var = 'score' | 's1' | 's2';
  let variable = $state<Var>('score');
  let cut = $state(0.5);
  let mine = $state<{ hook: string; exercise: string; enabled: boolean }[]>([]);
  let mineScores = $state.raw<Record<'light' | 'c' | 'b', number[]> | null>(null);
  let running = $state(false);
  let progress = $state(0);
  onMount(() => {
    mine = listMine().filter((m) => m.hook === 'reco.bTag' || m.hook === 'reco.impactParameter');
  });

  const FL = ['light', 'c', 'b'] as const;
  const NAMES = { light: 'light', c: 'charm', b: 'bottom' } as const;
  const COL = { light: 'var(--series-3)', c: 'var(--series-5)', b: 'var(--series-1)' } as const;
  const value = (row: number[], v: Var): number => (v === 'score' ? row[0]! : v === 's1' ? (row[1] ?? -10) : (row[2] ?? -10));
  const dom = $derived(variable === 'score' ? [0, 1] : [-6, 24]);
  const NB = 24;
  const edges = $derived(Array.from({ length: NB + 1 }, (_, i) => dom[0]! + ((dom[1]! - dom[0]!) * i) / NB));
  function hist(vals: number[]): number[] {
    const h = new Array<number>(NB).fill(0);
    for (const x of vals) {
      const k = Math.floor(((Math.min(Math.max(x, dom[0]!), dom[1]! - 1e-9) - dom[0]!) / (dom[1]! - dom[0]!)) * NB);
      h[k]!++;
    }
    return h;
  }
  const norm = (h: number[]) => {
    const t = h.reduce((a, b) => a + b, 0) || 1;
    return h.map((v) => (v / t) * 100);
  };
  const vals = $derived(Object.fromEntries(FL.map((f) => [f, IP_SAMPLE[f].map((r) => value(r, variable))])) as Record<(typeof FL)[number], number[]>);
  const hists = $derived(Object.fromEntries(FL.map((f) => [f, norm(hist(vals[f]))])) as Record<(typeof FL)[number], number[]>);
  const eff = $derived(Object.fromEntries(FL.map((f) => [f, vals[f].filter((x) => x > cut).length / vals[f].length])) as Record<(typeof FL)[number], number>);
  const mEff = $derived(mineScores ? Object.fromEntries(FL.map((f) => [f, mineScores![f].filter((x) => x > cut).length / Math.max(1, mineScores![f].length)])) as Record<(typeof FL)[number], number> : null);
  const roc = $derived.by(() => {
    const out: { b: number; l: number }[] = [];
    const lo = dom[0]!, hi = dom[1]!;
    for (let i = 0; i <= 80; i++) {
      const c = lo + ((hi - lo) * i) / 80;
      out.push({ b: vals.b.filter((x) => x > c).length / vals.b.length, l: Math.max(vals.light.filter((x) => x > c).length / vals.light.length, 1e-4) });
    }
    return out;
  });
  const fmt = (x: number) => (100 * x).toFixed(x < 0.01 ? 2 : 1) + ' %';
  const setVar = (v: Var) => {
    variable = v;
    cut = v === 'score' ? 0.5 : 3;
  };

  async function runMine() {
    if (running) return;
    running = true;
    progress = 0;
    applyMine();
    const r = rng(777);
    const cfg = presets.onion!;
    const out: Record<'light' | 'c' | 'b', number[]> = { light: [], c: [], b: [] };
    const N = 150;
    let done = 0;
    for (const f of FL) {
      for (let i = 0; i < N; i++) {
        const pt = 30 + 50 * r(), eta = (2 * r() - 1) * 1.5, phi = (2 * r() - 1) * Math.PI;
        const truth = synthetic.truthEventFrom(synthetic.jetParticles(r, f, pt, eta, phi), [0, 0, 0]);
        const det = simulate(truth, cfg, r.fork(`${f}${i}`));
        const reco = reconstruct(det, cfg, {}, truth);
        const axis = fromPtEtaPhiM(pt, eta, phi, 5);
        const j = reco.objects.filter((o) => o.kind === 'jet').sort((a, b) => deltaR(a.p, axis) - deltaR(b.p, axis))[0];
        if (j && deltaR(j.p, axis) < 0.4) out[f].push(j.btag ?? 0);
        if (++done % 15 === 0) {
          progress = done / (3 * N);
          await new Promise((res) => setTimeout(res, 0));
        }
      }
    }
    mineScores = out;
    running = false;
    progress = 1;
    if (variable !== 'score') setVar('score');
  }
</script>

<Widget {title} {n} {caption} kind="Simulation" onreset={() => { setVar('score'); mineScores = null; }}>
  {#snippet controls()}
    <div class="ctl">
      <Segmented
        label="What to plot"
        size="sm"
        bind:value={variable}
        onchange={(v) => setVar(v)}
        options={[
          { value: 'score', label: 'b-tag score (reference)' },
          { value: 's2', label: '2nd-largest IP significance' },
          { value: 's1', label: 'largest IP significance' },
        ]}
      />
      <Slider bind:value={cut} min={dom[0]!} max={dom[1]!} step={variable === 'score' ? 0.01 : 0.1} label={variable === 'score' ? 'Cut on the score' : 'Cut on the significance'} format={(v) => v.toFixed(variable === 'score' ? 2 : 1)} />
      {#if mine.length}<Button size="sm" onclick={runMine} disabled={running}>{running ? `Running… ${(100 * progress).toFixed(0)} %` : 'Run my code on 150 jets of each flavour'}</Button>{/if}
    </div>
  {/snippet}
  <div class="grid">
    <div>
      <HepHist
        label="Distribution of the chosen b-tagging variable for simulated light, charm and bottom jets, in per cent of each flavour"
        series={FL.map((f) => ({ edges, counts: hists[f], label: `${NAMES[f]} jets`, color: COL[f], errors: false }))}
        x={{ domain: [dom[0]!, dom[1]!], label: variable === 'score' ? 'b-tag score' : 'signed impact-parameter significance' }}
        y={{ type: 'log', domain: [0.05, 100], label: 'per cent of jets per bin' }}
        markers={[{ x: cut, label: 'cut', at: 0.12 }]}
        height={290}
      />
    </div>
    <div>
      <Plot x={{ type: 'log', domain: [1e-4, 1], label: 'light-jet mistag rate', tickValues: [1e-4, 1e-3, 1e-2, 1e-1, 1], format: (v) => (v >= 1 ? '1' : `1e${Math.round(Math.log10(v))}`) }} y={{ domain: [0, 1], label: 'b-jet efficiency' }} height={290} crosshair={false} label="b-jet efficiency against light-jet mistag rate as the cut moves">
        {#snippet marks({ sx, sy })}
          <path d={roc.map((p, i) => `${i ? 'L' : 'M'}${sx(p.l)},${sy(p.b)}`).join('')} fill="none" stroke="var(--series-1)" stroke-width="2.2" />
          <circle cx={sx(Math.max(eff.light, 1e-4))} cy={sy(eff.b)} r="6" fill="var(--accent)" stroke="var(--panel)" stroke-width="1.5" />
        {/snippet}
      </Plot>
    </div>
  </div>
  <table class="ui tab" aria-live="polite">
    <thead><tr><th>Cut: {variable === 'score' ? cut.toFixed(2) : cut.toFixed(1)}</th>{#each FL as f}<th>{NAMES[f]} jets passing</th>{/each}</tr></thead>
    <tbody>
      <tr><th scope="row">reference tagger on the stored sample</th>{#each FL as f}<td>{fmt(eff[f])}</td>{/each}</tr>
      {#if mEff}<tr><th scope="row">your code, {mineScores?.b.length ?? 0} b jets (score; cut as above)</th>{#each FL as f}<td>{fmt(mEff[f])}</td>{/each}</tr>{/if}
    </tbody>
  </table>
  <p class="ui note">About {IP_SAMPLE.light.length} light, {IP_SAMPLE.c.length} charm and {IP_SAMPLE.b.length} bottom jets. The light-jet rate is better than in a real detector because the simulation has no gluon splitting to heavy flavour, no hadronic interactions in the material and no fake tracks.</p>
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
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: 1rem;
  }
  @media (max-width: 860px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .tab {
    border-collapse: collapse;
    font-size: 0.84rem;
    margin-top: 0.6rem;
  }
  .tab th,
  .tab td {
    padding: 0.15rem 1.2rem 0.15rem 0;
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
  .note {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
