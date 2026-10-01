<!--
  The look-elsewhere effect. If a bump could have appeared in any of N independent places, the chance that *some* place fluctuates up to a
  given local significance is about N times larger than the chance for one place fixed in advance. Move the number of effective windows and the
  local significance and read off the global p-value and significance.

  The scenario button loads a schematic "750 GeV diphoton" story. THE NUMBERS ARE ILLUSTRATIVE, chosen to be of the same order as the excess that two
  LHC experiments reported in December 2015 and that faded in 2016; they are not the experiments' values.

    ::look-elsewhere{n="28.4" caption="…"}

  Props: `windows` initial number of independent windows, `z` initial local significance, `n`, `caption`.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { lookElsewhere, pToZ, zToP } from '$lib/hep/analysis';
  import { rng as makeRng } from '$lib/hep/random';
  import { fmtP, fmtZ, sig } from './common';

  let { windows: w0 = 100, z: z0 = 3, n, caption, title = 'The look-elsewhere effect' }: { windows?: number; z?: number; n?: string | number; caption?: string; title?: string } = $props();

  let N = $state(untrack(() => w0));
  let zLocal = $state(untrack(() => z0));
  let seed = $state(5);
  let story = $state(false);

  const res = $derived(lookElsewhere(Math.round(N), zLocal));
  /** The local significance needed for a global one of zTarget with N windows: p_local = 1 − (1 − p_global)^(1/N). */
  const localNeeded = (zTarget: number) => pToZ(-Math.expm1(Math.log1p(-zToP(zTarget)) / Math.round(N)));
  const need3 = $derived(localNeeded(3));
  const need5 = $derived(localNeeded(5));
  /** The typical (median) largest fluctuation among N signal-free windows: P(max Z ≥ z) = 1/2. */
  const typical = $derived(pToZ(-Math.expm1(Math.log(0.5) / Math.round(N))));

  function scenario() {
    N = 200;
    zLocal = 3.9;
    story = true;
  }
  function manual() {
    story = false;
  }

  // A row of signal-free windows: local significance of each, from a seeded normal variable. Each drawn bar is the largest of k windows when N > 240.
  const BARS = 240;
  const bars = $derived.by(() => {
    const r = makeRng(seed);
    const total = Math.round(N);
    const k = Math.max(1, Math.ceil(total / BARS));
    const nb = Math.ceil(total / k);
    const out: number[] = [];
    for (let i = 0; i < nb; i++) {
      let m = -Infinity;
      const cnt = Math.min(k, total - i * k);
      for (let j = 0; j < cnt; j++) {
        // A standard normal by Box–Muller from the seeded generator.
        const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
        if (z > m) m = z;
      }
      out.push(m);
    }
    return { z: out, k };
  });
  const maxBar = $derived(Math.max(...bars.z));
  const curves = [1, 10, 100, 1000, 10000];
  const curve = (nn: number) => Array.from({ length: 61 }, (_, i) => {
    const zl = i * 0.1;
    const r = lookElsewhere(nn, zl);
    return [zl, Math.max(-0.5, Number.isFinite(r.zGlobal) ? r.zGlobal : -0.5)] as const;
  });
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={N} min={1} max={10000} log label="Independent windows N" format={(v) => Math.round(v).toLocaleString('en-GB')} oninput={manual} />
    <Slider bind:value={zLocal} min={0} max={6} step={0.05} label="Local significance" format={(v) => `${v.toFixed(2)}σ`} oninput={manual} />
    <div class="buttons ui">
      <Button variant="primary" onclick={scenario}>Load the 750 GeV-like scenario (illustrative)</Button>
      <Button onclick={() => (seed = seed + 1)}>Re-roll the windows <span class="seed">seed {seed}</span></Button>
    </div>
  {/snippet}

  <div class="grid">
    <div class="pane">
      <h5 class="ui">Global against local significance</h5>
      <Plot x={{ domain: [0, 6], label: 'Local significance [σ]' }} y={{ domain: [0, 6], label: 'Global significance [σ]' }} height={300} label="Global significance against local significance for different numbers of independent windows">
        {#snippet marks({ sx, sy })}
          {#each curves as nn, k}
            {@const pts = curve(nn)}
            <path d={pts.map(([a, b], i) => `${i ? 'L' : 'M'}${sx(a)},${sy(b)}`).join('')} fill="none" stroke={k === 0 ? 'var(--ink-3)' : `var(--series-${k + 1})`} stroke-width="1.4" />
            <text x={sx(pts[pts.length - 1]![0]) - 4} y={sy(pts[pts.length - 1]![1]) - 5} text-anchor="end" class="lbl" fill={k === 0 ? 'var(--ink-3)' : `var(--series-${k + 1})`}>{nn === 1 ? 'N = 1' : nn.toLocaleString('en-GB')}</text>
          {/each}
          <line x1={sx(0)} x2={sx(6)} y1={sy(3)} y2={sy(3)} stroke="var(--series-1)" stroke-dasharray="4 3" opacity="0.7" />
          <line x1={sx(0)} x2={sx(6)} y1={sy(5)} y2={sy(5)} stroke="var(--bad)" stroke-dasharray="4 3" opacity="0.7" />
          <text x={sx(0.1)} y={sy(3) - 4} class="lbl" fill="var(--series-1)">3σ</text>
          <text x={sx(0.1)} y={sy(5) - 4} class="lbl" fill="var(--bad)">5σ</text>
          <line x1={sx(zLocal)} x2={sx(zLocal)} y1={sy(0)} y2={sy(Math.max(0, res.zGlobal))} stroke="var(--sig-high)" stroke-width="1.5" />
          <line x1={sx(0)} x2={sx(zLocal)} y1={sy(Math.max(0, res.zGlobal))} y2={sy(Math.max(0, res.zGlobal))} stroke="var(--sig-high)" stroke-width="1.5" />
          <circle cx={sx(zLocal)} cy={sy(Math.max(0, res.zGlobal))} r="5" fill="var(--sig-high)" stroke="var(--panel)" stroke-width="1.5" />
        {/snippet}
      </Plot>
    </div>
    <div class="pane">
      <h5 class="ui">With no signal at all, N windows: local significance of each</h5>
      <svg viewBox="0 0 600 220" class="strip" role="img" aria-label="Local significance of each signal-free window; the largest is highlighted">
        <line x1="24" x2="596" y1="190" y2="190" stroke="var(--axis)" />
        {#each [1, 2, 3, 4] as l}<line x1="24" x2="596" y1={190 - l * 38} y2={190 - l * 38} stroke="var(--grid)" /><text x="20" y={190 - l * 38 + 4} text-anchor="end" class="tick">{l}σ</text>{/each}
        {#each bars.z as z, i}
          {@const bw = 572 / bars.z.length}
          {@const h = Math.max(0, Math.min(4.6, z)) * 38}
          <rect x={24 + i * bw + 0.3} y={190 - h} width={Math.max(1, bw - 0.8)} height={h} fill={z === maxBar ? 'var(--sig-high)' : 'var(--series-8)'} />
        {/each}
        <text x="310" y="212" text-anchor="middle" class="axl">window number (mass)</text>
      </svg>
      <p class="ui cap">
        Largest here: <strong>{fmtZ(maxBar, 1)}</strong>{#if bars.k > 1} (each bar is the largest of {bars.k} windows){/if}. Across many such experiments the median largest fluctuation among {Math.round(N).toLocaleString('en-GB')} windows is about <strong>{fmtZ(typical, 1)}</strong>.
      </p>
    </div>
  </div>

  <div class="readout ui" aria-live="polite">
    <div class="card">
      <span class="k">Local p-value</span>
      <strong class="v">{fmtP(res.pLocal)}</strong>
      <span class="s">{fmtZ(zLocal)}: if the place was chosen in advance</span>
    </div>
    <div class="card hot">
      <span class="k">Global p-value, N = {Math.round(N).toLocaleString('en-GB')}</span>
      <strong class="v">{fmtP(res.pGlobal)} = {fmtZ(res.zGlobal)}</strong>
      <span class="s">chance that some window does this: 1 − (1 − p)<sup>N</sup></span>
    </div>
    <div class="card">
      <span class="k">Trials factor</span>
      <strong class="v">× {sig(res.trialsFactor, 3)}</strong>
      <span class="s">For a global 3σ you need {fmtZ(need3, 2)} locally; for 5σ, {fmtZ(need5, 2)}.</span>
    </div>
  </div>

  {#if story}
    <div class="story ui" role="note">
      <strong>Illustrative scenario: a photon-pair excess at 750 GeV.</strong> In December 2015 two LHC experiments each reported a small excess of pairs of photons with a combined
      mass near 750 GeV. A local significance approaching 4σ (in one of them) looked striking; but the search had scanned hundreds of effectively independent mass and width hypotheses, so the chance of a
      fluctuation that large <em>somewhere</em> was around one per cent: a global significance near 2σ. With the larger data sample of 2016 the excess did not grow; it was gone.
      <em>The numbers on this page (N = 200 windows, local 3.9σ) are schematic and of the right order, not the experiments' values.</em>
    </div>
  {/if}
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 1rem;
  }
  @media (max-width: 1100px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .pane {
    min-width: 0;
  }
  h5 {
    margin: 0 0 0.35rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .seed {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--mute);
    margin-left: 0.3rem;
  }
  .lbl {
    font-size: 11px;
    font-family: var(--font-ui);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .tick {
    font-size: 11px;
    fill: var(--ink-3);
  }
  .axl {
    font-size: 11px;
    fill: var(--ink-2);
  }
  .strip {
    width: 100%;
    height: auto;
    background: var(--chart-surface);
    display: block;
  }
  .cap {
    margin: 0.4rem 0 0;
    font-size: 0.82rem;
    color: var(--ink-2);
    line-height: 1.45;
  }
  .readout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
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
  .card.hot {
    border-color: var(--sig-high);
  }
  .k {
    font-size: 0.72rem;
    color: var(--mute);
    text-transform: none;
    letter-spacing: 0;
  }
  .v {
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 600;
  }
  .s {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.4;
  }
  .story {
    margin-top: 0.8rem;
    padding: 0.7rem 0.9rem;
    border-left: 3px solid var(--c-history);
    background: var(--pn);
    border-radius: 0 6px 6px 0;
    font-size: 0.86rem;
    line-height: 1.55;
    color: var(--ink-2);
  }
</style>
