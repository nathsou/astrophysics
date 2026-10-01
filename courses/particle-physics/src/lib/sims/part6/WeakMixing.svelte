<!--
  The weak mixing angle (Chapter 23): one number ties together the ratio of the W and Z masses and the neutral-current rates of neutrino scattering.
  Left: the tree-level masses m_W = A/sinθ_W and m_Z = A/(sinθ_W cosθ_W), with A = (πα/√2 G_F)^½, against the measured values, for α at q² = 0 or at the Z scale.
  Right: R_ν and R_ν̄, the ratios of neutral-current to charged-current events for neutrinos and antineutrinos on an isoscalar target (quark model), against sin²θ_W.
  No measured neutral-current ratio is drawn on the right: the published ratios are for events above a hadron-energy threshold, which a simple formula does not include.

    ::weak-mixing{n="23.1" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { M_W, M_Z } from '$lib/hep/sm';
  import { ALPHAS, neutralCurrentRatios, rangeFm, treeMasses } from './electroweak';

  let { n, caption, title = 'One angle, three predictions' }: { n?: string | number; caption?: string; title?: string } = $props();

  let s2 = $state(0.2312);
  let which = $state<'zero' | 'atZ'>('atZ');
  const alpha = $derived(ALPHAS[which]);
  const m = $derived(treeMasses(s2, alpha));
  const nc = $derived(neutralCurrentRatios(s2));
  const curve = (f: (x: number) => number) => Array.from({ length: 101 }, (_, i) => ({ x: 0.05 + (0.45 * i) / 100, y: f(0.05 + (0.45 * i) / 100) }));
  const cNu = curve((x) => neutralCurrentRatios(x).nu);
  const cBar = curve((x) => neutralCurrentRatios(x).nubar);
  const pct = (a: number, b: number) => `${(100 * (a / b - 1)).toFixed(1)} %`;
  const bars = $derived([
    { key: 'W', label: 'W', pred: m.mW, meas: M_W },
    { key: 'Z', label: 'Z', pred: m.mZ, meas: M_Z },
  ]);
</script>

<Widget {title} {n} {caption} kind="Explore" onreset={() => { s2 = 0.2312; which = 'atZ'; }}>
  {#snippet controls()}
    <div class="ctl">
      <Slider bind:value={s2} min={0.15} max={0.35} step={0.001} label="Weak mixing angle, sin²θ_W" format={(v) => v.toFixed(3)} />
      <Segmented label="Electromagnetic coupling" size="sm" bind:value={which} options={[{ value: 'zero', label: 'α at q² = 0 (1/137.04)' }, { value: 'atZ', label: 'α at the Z scale (1/127.95)' }]} />
    </div>
  {/snippet}
  <div class="grid">
    <section aria-label="Predicted W and Z masses">
      <h5 class="ui">W and Z masses from (α, G_F, sin²θ_W), tree level</h5>
      <table class="ui tab">
        <thead><tr><th></th><th>Predicted</th><th>Measured</th><th>Difference</th></tr></thead>
        <tbody>
          {#each bars as b}
            <tr><th scope="row">m<sub>{b.label}</sub></th><td>{b.pred.toFixed(2)} GeV</td><td>{b.meas.toFixed(2)} GeV</td><td class:ok={Math.abs(b.pred / b.meas - 1) < 0.005}>{pct(b.pred, b.meas)}</td></tr>
          {/each}
          <tr><th scope="row">A = (πα/√2 G_F)<sup>½</sup></th><td colspan="3">{m.A.toFixed(2)} GeV</td></tr>
          <tr><th scope="row">Range ħc/m<sub>W</sub></th><td colspan="3">{(rangeFm(M_W) * 1e-15 * 1e0).toExponential(2)} m ({rangeFm(M_W).toFixed(4)} fm)</td></tr>
        </tbody>
      </table>
      <p class="ui note">Tree level: m_W sinθ_W = m_Z sinθ_W cosθ_W = A. The larger the angle, the lighter the W. The measured masses are the table's (PDG 2024). Using α at q² = 0 misses by 3 % and more; the running of α to the Z scale accounts for most of the gap. The remaining loop corrections are small and partly cancel, so the agreement at 0.3 % is better than a tree-level formula deserves.</p>
    </section>
    <section aria-label="Neutral-current ratios in neutrino scattering">
      <h5 class="ui">Neutral current to charged current in ν and ν̄ scattering</h5>
      <Plot x={{ domain: [0.05, 0.5], label: 'sin²θ_W' }} y={{ domain: [0, 0.6], label: 'NC / CC' }} height={230} label="Neutral-current to charged-current ratios for neutrinos and antineutrinos against the weak mixing angle" crosshair={false}>
        {#snippet marks({ sx, sy })}
          <path d={cNu.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)},${sy(p.y)}`).join('')} fill="none" stroke="var(--series-1)" stroke-width="2.2" />
          <path d={cBar.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)},${sy(p.y)}`).join('')} fill="none" stroke="var(--series-3)" stroke-width="2.2" stroke-dasharray="6 3" />
          <text x={sx(0.06)} y={sy(neutralCurrentRatios(0.06).nu) - 6} class="lbl" fill="var(--series-1)">R<tspan dy="3" font-size="8">ν</tspan></text>
          <text x={sx(0.06)} y={sy(neutralCurrentRatios(0.06).nubar) - 6} class="lbl" fill="var(--series-3)">R<tspan dy="3" font-size="8">ν̄</tspan></text>
          <line x1={sx(s2)} x2={sx(s2)} y1={sy(0)} y2={sy(0.6)} stroke="var(--ink-2)" stroke-dasharray="3 3" />
          <circle cx={sx(s2)} cy={sy(nc.nu)} r="5" fill="var(--series-1)" />
          <circle cx={sx(s2)} cy={sy(nc.nubar)} r="5" fill="var(--series-3)" />
        {/snippet}
      </Plot>
      <p class="ui note" aria-live="polite">At sin²θ_W = {s2.toFixed(3)}: R<sub>ν</sub> = {nc.nu.toFixed(3)}, R<sub>ν̄</sub> = {nc.nubar.toFixed(3)} (quark model with r = σ̄<sub>CC</sub>/σ<sub>CC</sub> = 0.4). The neutral current is a substantial fraction of the charged one for any plausible angle: searching for it was a matter of looking in the right place.</p>
    </section>
  </div>
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
    gap: 1.4rem;
  }
  @media (max-width: 860px) {
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
  .tab {
    border-collapse: collapse;
    font-size: 0.84rem;
    font-variant-numeric: tabular-nums;
    width: 100%;
  }
  .tab th,
  .tab td {
    padding: 0.2rem 0.6rem 0.2rem 0;
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
  .ok {
    color: var(--ok) !important;
  }
  .note {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
  .lbl {
    font-size: 11px;
    font-family: var(--font-ui);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
</style>
