<!--
  Counting neutrinos (Chapter 23 flagship). SIMULATED, LEP-LIKE pseudo-data: the course generator (`hep/gen`, e⁺e⁻ → hadrons through γ and Z,
  the first QCD correction and initial-state radiation) gives the cross-section for N_ν = 2, 3 or 4 light neutrino species; the seven scan
  energies and luminosities resemble LEP's; the counts are Poisson-fluctuated from a seeded generator. Nothing here is LEP data.
  Each species adds Γ_νν = 0.166 GeV to the Z's total width (leaving the visible partial widths alone), which lowers and broadens the peak.
  The fit uses `fitBinned` from `hep/analysis` with one bin per scan point.

    ::counting-neutrinos{n="23.2" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { eeToFermions } from '$lib/hep/gen';
  import { M_Z } from '$lib/hep/sm';
  import { SCAN, SELECTION_EFFICIENCY, GAMMA_NU, fitAtFixedN, fitLineshape, pseudoData, sigmaHad, zWidthFor } from './lineshape';

  let { n, caption, title = 'Counting neutrinos', seed: seed0 = 4 }: { n?: string | number; caption?: string; title?: string; seed?: number } = $props();

  let hyp = $state<'2' | '3' | '4'>('4');
  let logScale = $state(0);
  let seed = $state(seed0);
  let freeNorm = $state(false);
  let lumiSyst = $state(0);
  let showBorn = $state(false);

  const lumiScale = $derived(10 ** logScale);
  const data = $derived(pseudoData(seed, { lumiScale, lumiSyst: lumiSyst / 100 }));
  const H = $derived(Number(hyp));
  const fitFree = $derived(fitLineshape(data.counts, { freeNorm, lumiScale }));
  const chi2 = $derived.by(() => ({ 2: fitAtFixedN(data.counts, 2, { freeNorm, lumiScale }), 3: fitAtFixedN(data.counts, 3, { freeNorm, lumiScale }), 4: fitAtFixedN(data.counts, 4, { freeNorm, lumiScale }) }));
  const ndf = $derived(SCAN.length - 1 - (freeNorm ? 1 : 0));

  const pts = $derived(
    SCAN.map((s, i) => {
      const c = data.counts[i]!;
      const f = 1000 * s.L * lumiScale * SELECTION_EFFICIENCY;
      return { E: s.E, sigma: c / f, err: Math.sqrt(Math.max(c, 1)) / f, pred: sigmaHad(s.E - chi2[H as 2 | 3 | 4].dm, H) * (freeNorm ? chi2[H as 2 | 3 | 4].k : 1) };
    }),
  );
  const EG = Array.from({ length: 141 }, (_, i) => 88 + (i * 7.5) / 140);
  const curves = $derived([2, 3, 4].map((N) => ({ N, path: EG.map((E) => ({ E, s: sigmaHad(E, N) })) })));
  const born = $derived(showBorn ? EG.map((E) => ({ E, s: eeToFermions({ final: 'hadrons', qcd: true, zWidth: zWidthFor(3) }).sigma(E) / 1000 })) : []);
  const colour = { 2: 'var(--series-3)', 3: 'var(--series-1)', 4: 'var(--series-8)' } as const;
  const dev = $derived(pts.map((p) => ({ E: p.E, r: p.sigma / p.pred - 1, e: p.err / p.pred })));
  const devMax = $derived(Math.max(0.02, ...dev.map((d) => Math.abs(d.r) + d.e)) * 1.15);
  const nEvents = $derived(data.counts.reduce((a, b) => a + b, 0));
  const fmt = (x: number, d = 1) => x.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d });
  const sigmaDev = (d: number) => Math.sqrt(Math.max(0, d));
  const dChi = $derived(Math.max(0, chi2[H as 2 | 3 | 4].chi2 - Math.min(chi2[2].chi2, chi2[3].chi2, chi2[4].chi2)));
</script>

<Widget {title} {n} {caption} kind="Simulation" onreset={() => { hyp = '4'; logScale = 0; seed = seed0; freeNorm = false; lumiSyst = 0; showBorn = false; }}>
  {#snippet controls()}
    <div class="ctl">
      <Segmented label="Hypothesis: number of light neutrino species" size="sm" bind:value={hyp} options={[{ value: '2', label: '2 species' }, { value: '3', label: '3 species' }, { value: '4', label: '4 species' }]} />
      <Slider bind:value={logScale} min={-3.5} max={0} step={0.1} label="Amount of data, relative to LEP-like 1989–95" format={(v) => (10 ** v >= 0.1 ? (10 ** v).toFixed(2) : (10 ** v).toExponential(1))} />
      <Slider bind:value={lumiSyst} min={0} max={0.5} step={0.01} label="Luminosity error the analysis does not know about [%]" format={(v) => v.toFixed(2)} />
      <Toggle bind:checked={freeNorm} label="Normalisation free (the shape alone)" />
      <Toggle bind:checked={showBorn} label="Show the no-radiation peak" />
      <Button size="sm" onclick={() => (seed = seed + 1)}>New pseudo-data (seed {seed})</Button>
    </div>
  {/snippet}

  <div class="panel">
    <Plot x={{ domain: [88, 95.5], label: 'centre-of-mass energy √s [GeV]' }} y={{ domain: [0, 36], label: 'σ(e⁺e⁻ → hadrons) [nb]' }} height={290} label="The hadronic cross-section against the centre-of-mass energy: simulated LEP-like points and the predicted peaks for two, three and four neutrino species" crosshair={false}>
      {#snippet marks({ sx, sy })}
        {#each curves as c}
          <path d={c.path.map((p, i) => `${i ? 'L' : 'M'}${sx(p.E)},${sy(p.s)}`).join('')} fill="none" stroke={colour[c.N as 2 | 3 | 4]} stroke-width={c.N === H ? 3 : 1.4} opacity={c.N === H ? 1 : 0.6} stroke-dasharray={c.N === H ? '' : '5 3'} />
        {/each}
        {#if born.length}
          <path d={born.map((p, i) => `${i ? 'L' : 'M'}${sx(p.E)},${sy(Math.min(p.s, 35.9))}`).join('')} fill="none" stroke="var(--ink-3)" stroke-width="1.2" stroke-dasharray="2 3" />
          <text x={sx(M_Z) + 26} y={sy(35) + 4} class="lbl">without radiation: 41 nb</text>
        {/if}
        {#each pts as p}
          <line x1={sx(p.E)} x2={sx(p.E)} y1={sy(p.sigma + p.err)} y2={sy(Math.max(0, p.sigma - p.err))} stroke="var(--ink)" stroke-width="1.6" />
          <circle cx={sx(p.E)} cy={sy(p.sigma)} r="3.6" fill="var(--ink)" />
        {/each}
        <text x={sx(94.2)} y={sy(sigmaHad(94.2, 2)) - 16} class="lbl" fill={colour[2]}>2</text>
        <text x={sx(94.2)} y={sy(sigmaHad(94.2, 3)) - 4} class="lbl" fill={colour[3]}>3</text>
        <text x={sx(94.2)} y={sy(sigmaHad(94.2, 4)) + 14} class="lbl" fill={colour[4]}>4</text>
      {/snippet}
    </Plot>
    <p class="ui legend">Points: simulated, LEP-like, with error bars (too small to see at full statistics). Lines: generator prediction for 2, 3 and 4 species (the chosen one thick).</p>
    <Plot x={{ domain: [88, 95.5], label: 'centre-of-mass energy √s [GeV]' }} y={{ domain: [-devMax, devMax], label: `data / ${H}-species fit − 1`, format: (v) => `${(100 * v).toFixed(v === 0 ? 0 : 1)} %` }} height={170} label="Residuals of the simulated points from the chosen hypothesis" crosshair={false}>
      {#snippet marks({ sx, sy, width })}
        <line x1="0" x2={width} y1={sy(0)} y2={sy(0)} stroke="var(--line-strong)" />
        {#each dev as d}
          <line x1={sx(d.E)} x2={sx(d.E)} y1={sy(d.r + d.e)} y2={sy(d.r - d.e)} stroke="var(--ink)" stroke-width="1.6" />
          <circle cx={sx(d.E)} cy={sy(d.r)} r="3.4" fill="var(--ink)" />
        {/each}
      {/snippet}
    </Plot>
  </div>

  <div class="readout ui" aria-live="polite">
    <table>
      <thead><tr><th scope="col">Hypothesis</th><th scope="col">χ² (Poisson, {ndf} d.o.f.)</th><th scope="col">Distance from the best</th></tr></thead>
      <tbody>
        {#each [2, 3, 4] as N}
          {@const c = chi2[N as 2 | 3 | 4].chi2}
          <tr class:on={N === H}><th scope="row">{N} species</th><td>{fmt(c, c < 100 ? 1 : 0)}</td><td>{c - Math.min(chi2[2].chi2, chi2[3].chi2, chi2[4].chi2) < 0.5 ? 'best' : `${fmt(sigmaDev(c - Math.min(chi2[2].chi2, chi2[3].chi2, chi2[4].chi2)), 0)}σ`}</td></tr>
        {/each}
      </tbody>
    </table>
    <p class="sub">
      Free fit: <strong>N<sub>ν</sub> = {fmt(fitFree.N, 3)} ± {fmt(fitFree.dN, 3)}</strong>, from {nEvents.toLocaleString('en-GB')} simulated hadronic Z decays ({freeNorm ? 'normalisation free: only the width and shape count' : 'luminosity taken as known: the height of the peak counts too'}).
      The true value in the simulation is 3{lumiSyst > 0 ? `, but the luminosity actually differs from the assumed one by ${fmt(100 * data.lumiError, 2)} %` : ''}. Each species adds Γ<sub>νν</sub> = {(1000 * GAMMA_NU).toFixed(0)} MeV to the width ({(zWidthFor(3)).toFixed(3)} GeV for 3).
    </p>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
    align-items: end;
  }
  .lbl {
    font-size: 11px;
    font-family: var(--font-ui);
    fill: var(--ink-2);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .legend {
    margin: 0.2rem 0 0.6rem;
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  .readout table {
    border-collapse: collapse;
    font-size: 0.84rem;
    font-variant-numeric: tabular-nums;
    margin-top: 0.4rem;
  }
  th,
  td {
    padding: 0.15rem 1.2rem 0.15rem 0;
    text-align: left;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    color: var(--ink-2);
  }
  td {
    color: var(--fg);
    font-family: var(--font-mono);
  }
  tr.on th,
  tr.on td {
    font-weight: 600;
    color: var(--fg);
  }
  .sub {
    margin: 0.6rem 0 0;
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
</style>
