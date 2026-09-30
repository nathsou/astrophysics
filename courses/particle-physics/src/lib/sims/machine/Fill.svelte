<!--
  A fill: luminosity decays as protons are burnt off in collisions and lost to other processes, so there is a best moment to dump the beam,
  refill and start again. Set the peak luminosity, the lifetime from other losses, the turnaround time and the fill length.

    ::fill{n="21.5" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { LHC_DESIGN, burnOffTime, cm2ToInvFb, integratedLuminosity, luminosityAt, optimalFill } from '$lib/hep/machine';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let L0 = $state(2); // 1e34
  let tauOther = $state(20); // h
  let turnaround = $state(3); // h
  let burn = $state(true);
  let T = $state(10); // h

  const N0 = LHC_DESIGN.Nb * LHC_DESIGN.nb;
  const H = 3600;
  const tauB = $derived(burn ? burnOffTime(N0, L0 * 1e34, 2) : Infinity);
  const opt = $derived(optimalFill(L0 * 1e34, tauB, tauOther * H, turnaround * H, 40 * H));
  const cur = $derived(integratedLuminosity(T * H, L0 * 1e34, tauB, tauOther * H));
  const curAvg = $derived(cur / ((T + turnaround) * H));
  const tEnd = $derived(Math.max(24, T * 1.25));
  const curve = $derived(Array.from({ length: 121 }, (_, i) => { const t = (tEnd * i) / 120; return { t, l: luminosityAt(t * H, L0, tauB, tauOther * H) }; }));
  const avgCurve = $derived(Array.from({ length: 81 }, (_, i) => { const t = 0.5 + (39.5 * i) / 80; return { t, a: (integratedLuminosity(t * H, L0 * 1e34, tauB, tauOther * H, 120) / ((t + turnaround) * H)) / 1e34 }; }));
  const f = (x: number, d = 2) => x.toFixed(d);
  const perDay = $derived(cm2ToInvFb(curAvg * 86400));
</script>

<Widget title="One fill of the LHC" subtitle="Luminosity decays during a fill; when is the best time to stop?" {n} {caption} kind="Explore" onreset={() => { L0 = 2; tauOther = 20; turnaround = 3; burn = true; T = 10; }}>
  {#snippet controls()}
    <Slider bind:value={L0} min={0.5} max={3} step={0.1} label="Peak luminosity [10³⁴ cm⁻² s⁻¹]" format={(v) => v.toFixed(1)} />
    <Slider bind:value={tauOther} min={5} max={60} step={1} label="Lifetime from other losses [h]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={turnaround} min={1} max={12} step={0.5} label="Turnaround between fills [h]" format={(v) => v.toFixed(1)} />
    <Slider bind:value={T} min={1} max={36} step={0.5} label="Fill length [h]" format={(v) => v.toFixed(1)} />
    <Toggle bind:checked={burn} label="Burn-off in collisions (two experiments)" />
  {/snippet}

  <div class="fillw">
  <h5 class="ui">Luminosity during the fill</h5>
  <Plot
    label="Luminosity against time in hours, falling from {f(L0, 1)} × 10³⁴ with the fill ending at {f(T, 1)} hours"
    x={{ domain: [0, tEnd], label: 'time since stable beams [h]' }}
    y={{ domain: [0, Math.ceil(L0 * 10) / 10 * 1.05], label: 'L [10³⁴ cm⁻² s⁻¹]' }}
    height={240}
  >
    {#snippet marks({ sx, sy })}
      <path class="area" d={`M${sx(0)} ${sy(0)}` + curve.filter((p) => p.t <= T).map((p) => `L${sx(p.t)} ${sy(p.l)}`).join('') + `L${sx(Math.min(T, tEnd))} ${sy(0)}Z`} />
      <path class="line" d={curve.map((p, i) => `${i ? 'L' : 'M'}${sx(p.t)} ${sy(p.l)}`).join('')} />
      <line class="mark" x1={sx(T)} x2={sx(T)} y1={sy(0)} y2={sy(L0)} />
      <text x={sx(T) + 6} y={sy(L0) + 14} class="ann">dump at {f(T, 1)} h</text>
    {/snippet}
  </Plot>

  <h5 class="ui">Average luminosity over a whole cycle (fill + turnaround)</h5>
  <Plot
    label="Average luminosity over a cycle against fill length, with its maximum at {f(opt.fillLength / H, 1)} hours"
    x={{ domain: [0, 40], label: 'fill length [h]' }}
    y={{ domain: [0, Math.max(0.1, ...avgCurve.map((p) => p.a)) * 1.15], label: 'average L [10³⁴ cm⁻² s⁻¹]' }}
    height={220}
  >
    {#snippet marks({ sx, sy })}
      <path class="line2" d={avgCurve.map((p, i) => `${i ? 'L' : 'M'}${sx(p.t)} ${sy(p.a)}`).join('')} />
      <circle class="best" cx={sx(opt.fillLength / H)} cy={sy(opt.averageLumi / 1e34)} r="5.5" />
      <text x={sx(opt.fillLength / H) + 9} y={sy(opt.averageLumi / 1e34) - 7} class="ann">best: {f(opt.fillLength / H, 1)} h</text>
      <line class="mark" x1={sx(T)} x2={sx(T)} y1={sy(0)} y2={sy(curAvg / 1e34)} />
      <circle class="cur" cx={sx(T)} cy={sy(curAvg / 1e34)} r="4.5" />
    {/snippet}
  </Plot>

  <dl class="readout ui" role="status" aria-live="polite">
    <div><dt>Integrated luminosity of this fill</dt><dd>{f(cm2ToInvFb(cur), 3)} fb⁻¹</dd></div>
    <div><dt>Average over fill + turnaround</dt><dd>{f(curAvg / 1e34, 2)} × 10³⁴ ({f((curAvg / (L0 * 1e34)) * 100, 0)}% of peak)</dd></div>
    <div><dt>Per day at this schedule</dt><dd>{f(perDay, 2)} fb⁻¹</dd></div>
    <div><dt>Best fill length</dt><dd>{f(opt.fillLength / H, 1)} h → {f(cm2ToInvFb(opt.averageLumi * 86400), 2)} fb⁻¹ per day</dd></div>
    <div><dt>Burn-off time constant</dt><dd>{burn ? f(tauB / H, 0) + ' h' : 'off'}</dd></div>
  </dl>
  <p class="small ui">
    Burn-off: every proton–proton collision removes protons from the beams, so the intensity falls as 1/(1 + t/τ<sub>b</sub>), and the luminosity, which goes as the intensity squared, falls
    faster. A longer turnaround makes it worth staying longer; a shorter lifetime makes it worth leaving sooner.
    The beam intensity is that of the LHC design (1.15 × 10¹¹ protons in each of 2808 bunches) whatever the peak luminosity you choose.
  </p>
  </div>
</Widget>

<style>
  h5 {
    margin: 0.4rem 0 0.3rem;
    font-size: 0.82rem;
    color: var(--ink-2);
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
  }
  .fillw :global(.plot .area) {
    fill: var(--track-soft);
  }
  .fillw :global(.plot .line) {
    fill: none;
    stroke: var(--series-1);
    stroke-width: 2.4;
  }
  .fillw :global(.plot .line2) {
    fill: none;
    stroke: var(--series-3);
    stroke-width: 2.4;
  }
  .fillw :global(.plot .mark) {
    stroke: var(--sig-high);
    stroke-width: 1.8;
    stroke-dasharray: 5 4;
  }
  .fillw :global(.plot .best) {
    fill: var(--sig-high);
    stroke: var(--panel);
    stroke-width: 2;
  }
  .fillw :global(.plot .cur) {
    fill: var(--panel);
    stroke: var(--fg);
    stroke-width: 2;
  }
  .fillw :global(.plot .ann) {
    fill: var(--ink-2);
    font-size: 11.5px;
  }
  .readout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.4rem 1rem;
    margin: 0.8rem 0 0;
  }
  .readout div {
    border-left: 2px solid var(--line-strong);
    padding-left: 0.5rem;
  }
  dt {
    font-size: 0.72rem;
    color: var(--mute);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.86rem;
    font-variant-numeric: tabular-nums;
  }
  .small {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
