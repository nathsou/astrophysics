<!--
  Muon survival against energy (Chapter 10): the probability that a muon born at height h reaches the ground, exp(−d/(βγcτ)) with time dilation and
  exp(−d/cτ) without. Constants from hep/particles. Two readings of the same number: the atmosphere's thickness in the muon's rest frame is d/γ.

    ::muon-survival{n="10.4" caption="…"}
-->
<script lang="ts">
  import './part3.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { particle } from '$lib/hep/particles';
  import { pow10Label } from './fmt';

  let { n, caption }: { n?: string | number; caption?: string } = $props();
  const mu = particle(13);
  const C = 299_792_458;
  const ctau = mu.lifetime * C; // m
  let h = $state(15); // km
  let logE = $state(Math.log10(3)); // GeV total energy
  const E = $derived(10 ** logE);
  const gamma = $derived(E / mu.mass);
  const bg = $derived(Math.sqrt(Math.max(0, gamma * gamma - 1)));
  const dMeters = $derived(h * 1000);
  const Ldec = $derived(bg * ctau);
  const sWith = $derived(Math.exp(-dMeters / Ldec));
  const sWithout = $derived(Math.exp(-dMeters / ctau));
  const grid = Array.from({ length: 100 }, (_, i) => 10 ** (-0.9 + (i * 3.4) / 99));
  const curve = (f: (E: number) => number) => grid.map((e) => ({ e, s: Math.max(1e-30, f(e)) }));
  const withD = $derived(curve((e) => Math.exp(-dMeters / (Math.sqrt((e / mu.mass) ** 2 - 1) * ctau))).filter((p) => p.e > mu.mass * 1.0001));
  const noD = $derived(grid.map((e) => ({ e, s: sWithout })));
  const p = (a: { e: number; s: number }[], sx: (v: number) => number, sy: (v: number) => number) => a.map((q, i) => `${i ? 'L' : 'M'}${sx(q.e).toFixed(1)},${sy(q.s).toFixed(1)}`).join('');
  const f = (x: number) => (x >= 0.01 ? x.toPrecision(3) : x.toExponential(2));
  const tLab = $derived(dMeters / C);
  const tRest = $derived(tLab / gamma);
</script>

<Widget title="Will the muon arrive?" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={h} min={1} max={30} step={0.5} label="Height of birth [km]" format={(v) => v.toFixed(1) + ' km'} />
    <Slider bind:value={logE} min={-0.9} max={2.5} step={0.01} label="Muon energy E" format={(v) => (10 ** v).toPrecision(3) + ' GeV'} />
  {/snippet}
  <Plot
    height={260}
    label="Survival probability of a muon against its energy on logarithmic axes: with time dilation it rises from nearly zero to one; without dilation it is a constant, vanishingly small for a muon born at this height."
    x={{ type: 'log', domain: [0.12, 300], label: 'muon energy [GeV]', tickValues: [0.1, 1, 10, 100], format: (v) => String(v) }}
    y={{ type: 'log', domain: [1e-20, 2], label: 'survival probability', tickValues: [1e-18, 1e-12, 1e-6, 1], format: pow10Label }}
  >
    {#snippet marks({ sx, sy })}
      <path d={p(withD, sx, sy)} class="p3-line" stroke="var(--series-1)" />
      <path d={p(noD, sx, sy)} class="p3-line" stroke="var(--series-7)" stroke-dasharray="6 4" />
      <line x1={sx(E)} x2={sx(E)} y1="0" y2="1000" stroke="var(--series-8)" stroke-dasharray="2 3" />
      <circle cx={sx(E)} cy={sy(Math.max(1e-30, sWith))} r="5" fill="var(--series-1)" />
    {/snippet}
  </Plot>
  <ul class="ui p3-note" style="list-style:none;padding:0;display:flex;gap:1rem;flex-wrap:wrap">
    <li><span style="color: var(--series-1)">━</span> with time dilation: exp(−d/βγcτ)</li>
    <li><span style="color: var(--series-7)">┄</span> without: exp(−d/cτ), cτ = {ctau.toFixed(1)} m</li>
  </ul>
  <dl class="p3-out ui" aria-live="polite">
    <div><dt>γ · βγ</dt><dd>{gamma.toFixed(1)} · {bg.toFixed(1)}</dd></div>
    <div><dt>decay length βγcτ</dt><dd>{Ldec >= 1000 ? (Ldec / 1000).toFixed(1) + ' km' : Ldec.toFixed(0) + ' m'}</dd></div>
    <div><dt>survival, with dilation</dt><dd>{f(sWith)}</dd></div>
    <div><dt>survival, without</dt><dd>{f(sWithout)}</dd></div>
    <div><dt>flight time in the lab · in the muon's frame</dt><dd>{(tLab * 1e6).toFixed(1)} µs · {(tRest * 1e6).toFixed(2)} µs (τ = {(mu.lifetime * 1e6).toFixed(3)} µs)</dd></div>
    <div><dt>the atmosphere's thickness in the muon's frame</dt><dd>{(dMeters / gamma / 1000).toFixed(2)} km (length contraction)</dd></div>
  </dl>
  <p class="p3-note ui">No energy loss is included here (the shower toy includes it). The two readings in the last two rows are the same physics: in the lab the muon's clock runs slow; in the muon's frame the air is thin.</p>
</Widget>
