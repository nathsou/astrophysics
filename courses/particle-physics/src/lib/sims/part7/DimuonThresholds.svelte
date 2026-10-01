<!--
  What shapes the hump in the dimuon map (Chapter 27). The 100,000 real CMS muon pairs of Chapter 2 (static/data/dimuon.f32, CC0), with the
  transverse momentum of each muon. The top panel is the distribution of the pT of the SOFTER muon of each pair: it has steps, which are the
  thresholds of the triggers that selected these events (an inference: the data show the steps, not their cause). The bottom panel is the
  pair mass of the events that pass the two cuts you set. Raise the cut on the softer muon and the hump moves to the right: the mass of two
  muons flying back to back, each with transverse momentum pT, is about 2 pT, so a pT threshold is a mass threshold.

    ::dimuon-thresholds{n="27.3" caption="…"}

  Everything here is REAL DATA (no simulation). The masses are computed with the library's `pairMass` from the muon four-vectors.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import HepHist from '$lib/charts/HepHist.svelte';
  import { loadDimuon } from '$lib/hep/data';
  import { pairMass } from '$lib/hep/kinematics';
  import { sig } from '$lib/sims/stats/common';

  let { n, caption, title = 'The dimuon sample and the trigger thresholds' }: { n?: string | number; caption?: string; title?: string } = $props();

  interface Cols { m: Float32Array; soft: Float32Array; hard: Float32Array; dphi: Float32Array; n: number }
  let cols = $state<Cols | null>(null);
  let failed = $state<string | null>(null);

  let softCut = $state(0);
  let hardCut = $state(0);
  let angle = $state<'any' | 'back' | 'other'>('any');

  onMount(async () => {
    try {
      const d = await loadDimuon(base);
      const m = new Float32Array(d.n), soft = new Float32Array(d.n), hard = new Float32Array(d.n), dphi = new Float32Array(d.n);
      for (let i = 0; i < d.n; i++) {
        const a = d.mu1(i), b = d.mu2(i);
        m[i] = pairMass(a, b);
        const pa = Math.hypot(a.px, a.py), pb = Math.hypot(b.px, b.py);
        soft[i] = Math.min(pa, pb);
        hard[i] = Math.max(pa, pb);
        let dp = Math.abs(Math.atan2(a.py, a.px) - Math.atan2(b.py, b.px));
        if (dp > Math.PI) dp = 2 * Math.PI - dp;
        dphi[i] = dp;
      }
      cols = { m, soft, hard, dphi, n: d.n };
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e);
    }
  });

  const M_LO = 0, M_HI = 60, M_BINS = 120;
  const P_LO = 0, P_HI = 16, P_BINS = 64;
  const mEdges = Array.from({ length: M_BINS + 1 }, (_, i) => M_LO + ((M_HI - M_LO) * i) / M_BINS);
  const pEdges = Array.from({ length: P_BINS + 1 }, (_, i) => P_LO + ((P_HI - P_LO) * i) / P_BINS);
  const BACK = 0.9 * Math.PI;

  const result = $derived.by(() => {
    const allM = new Array<number>(M_BINS).fill(0);
    const selM = new Array<number>(M_BINS).fill(0);
    const softAll = new Array<number>(P_BINS).fill(0);
    const softSel = new Array<number>(P_BINS).fill(0);
    let nSel = 0, nHump = 0, nHumpAll = 0, nBackHump = 0;
    if (cols) {
      const { m, soft, hard, dphi } = cols;
      for (let i = 0; i < cols.n; i++) {
        const km = Math.floor(((m[i]! - M_LO) / (M_HI - M_LO)) * M_BINS);
        const kp = Math.floor(((soft[i]! - P_LO) / (P_HI - P_LO)) * P_BINS);
        if (km >= 0 && km < M_BINS) allM[km]!++;
        if (kp >= 0 && kp < P_BINS) softAll[kp]!++;
        const hump = m[i]! >= 8 && m[i]! < 20;
        if (hump) { nHumpAll++; if (dphi[i]! > BACK) nBackHump++; }
        const ok = soft[i]! >= softCut && hard[i]! >= hardCut && (angle === 'any' || (angle === 'back' ? dphi[i]! > BACK : dphi[i]! <= BACK));
        if (!ok) continue;
        nSel++;
        if (hump) nHump++;
        if (km >= 0 && km < M_BINS) selM[km]!++;
        if (kp >= 0 && kp < P_BINS) softSel[kp]!++;
      }
    }
    return { allM, selM, softAll, softSel, nSel, nHump, nHumpAll, nBackHump };
  });

  const maxM = $derived(Math.max(10, ...result.allM));
  const mDomain = $derived<[number, number]>([1, Math.pow(10, Math.ceil(Math.log10(maxM * 1.3)))]);
  const maxP = $derived(Math.max(10, ...result.softAll));
  const pDomain = $derived<[number, number]>([1, Math.pow(10, Math.ceil(Math.log10(maxP * 1.3)))]);

  function preset(s: number, h: number, a: 'any' | 'back' | 'other' = 'any') {
    softCut = s;
    hardCut = h;
    angle = a;
  }
  const edgeMass = $derived(2 * softCut);
</script>

<Widget {title} {n} {caption} kind="Real data">
  {#snippet controls()}
    <Slider bind:value={softCut} min={0} max={12} step={0.5} label="Softer muon pT at least (GeV)" format={(v) => v.toFixed(1)} />
    <Slider bind:value={hardCut} min={0} max={25} step={0.5} label="Harder muon pT at least (GeV)" format={(v) => v.toFixed(1)} />
    <Segmented
      label="Opening angle in the transverse plane"
      bind:value={angle}
      options={[
        { value: 'any', label: 'Any' },
        { value: 'back', label: 'Back to back (Δφ > 0.9π)' },
        { value: 'other', label: 'The rest' },
      ]}
    />
    <span class="row ui">
      <Button size="sm" onclick={() => preset(0, 0)}>All pairs</Button>
      <Button size="sm" onclick={() => preset(4, 0)}>Softer ≥ 4</Button>
      <Button size="sm" onclick={() => preset(6, 0)}>Softer ≥ 6</Button>
      <Button size="sm" onclick={() => preset(8, 13)}>8 and 13</Button>
    </span>
  {/snippet}

  {#if failed}
    <p class="ui err">Could not load the dimuon sample: {failed}</p>
  {:else if !cols}
    <p class="ui">Loading 100,000 real muon pairs…</p>
  {:else}
    <h5 class="ui sub">Transverse momentum of the softer muon of each pair</h5>
    <HepHist
      label="Histogram of the pT of the softer muon of each pair, for all pairs and for the selected pairs, with steps near 3, 4, 6 and 8 GeV"
      series={[
        { edges: pEdges, counts: result.softAll, label: 'all 100,000 pairs', color: 'var(--mute)' },
        { edges: pEdges, counts: result.softSel, label: 'selected', color: 'var(--series-1)', fill: true },
      ]}
      x={{ domain: [P_LO, P_HI], label: 'pT of the softer muon [GeV]' }}
      y={{ type: 'log', domain: pDomain, label: 'pairs per 0.25 GeV' }}
      markers={[{ x: 3, label: '3', at: 0.25 }, { x: 4, label: '4', at: 0.12 }, { x: 6, label: '6', at: 0.25 }, { x: 8, label: '8', at: 0.12 }]}
      height={230}
    />
    <h5 class="ui sub">Invariant mass of the selected pairs</h5>
    <HepHist
      label="Histogram of the invariant mass of the muon pairs from 0 to 60 GeV: all pairs and the selected pairs"
      series={[
        { edges: mEdges, counts: result.allM, label: 'all pairs', color: 'var(--mute)' },
        { edges: mEdges, counts: result.selM, label: 'selected', color: 'var(--series-2)', fill: true },
      ]}
      x={{ domain: [M_LO, M_HI], label: 'invariant mass of the pair [GeV]' }}
      y={{ type: 'log', domain: mDomain, label: 'pairs per 0.5 GeV' }}
      markers={softCut > 0 && edgeMass <= M_HI ? [{ x: edgeMass, label: `2 × ${softCut.toFixed(1)}`, at: 0.9 }] : []}
      height={250}
    />
    <div class="readout ui" aria-live="polite">
      <div class="card"><span class="k">Pairs selected</span><strong class="v">{result.nSel.toLocaleString('en-GB')} of {cols.n.toLocaleString('en-GB')}</strong></div>
      <div class="card">
        <span class="k">In the hump, 8 to 20 GeV</span>
        <strong class="v">{result.nHump.toLocaleString('en-GB')} of {result.nHumpAll.toLocaleString('en-GB')}</strong>
        <span class="s">{sig((100 * result.nHump) / Math.max(1, result.nHumpAll), 3)} % of the hump survives. {sig((100 * result.nBackHump) / Math.max(1, result.nHumpAll), 3)} % of all hump pairs are back to back.</span>
      </div>
      <div class="card">
        <span class="k">Smallest mass of a central pair, both muons at the cut, back to back</span>
        <strong class="v">{softCut > 0 ? `2 × ${softCut.toFixed(1)} = ${edgeMass.toFixed(1)} GeV` : 'no cut set'}</strong>
        <span class="s">The pair mass of two massless particles is 2√(pT₁pT₂) when they are back to back at the same η. The edge is where that equals the cut.</span>
      </div>
    </div>
  {/if}
</Widget>

<style>
  .sub {
    margin: 0.6rem 0 0.1rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
  }
  .row {
    display: inline-flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .err {
    color: var(--bad);
  }
  .readout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.6rem;
    margin-top: 0.8rem;
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.55rem 0.75rem;
    background: var(--pn);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .k {
    font-size: 0.72rem;
    color: var(--mute);
    text-transform: none;
    letter-spacing: 0;
  }
  .v {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 600;
  }
  .s {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.4;
  }
</style>
