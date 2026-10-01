<!--
  The cosmic-muon flux against zenith angle (Chapter 10): I(θ) = I₀ cos²θ, with the vertical intensity I₀ ≈ 70 m⁻² s⁻¹ sr⁻¹ for muons above 1 GeV at sea
  level (PDG, Cosmic rays). The rate in a small detector pointed at angle θ, and the integral over the sky for a horizontal detector, π/2 · I₀.

    ::zenith-flux{n="10.5" caption="…"}
-->
<script lang="ts">
  import './part3.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';

  let { n, caption }: { n?: string | number; caption?: string } = $props();
  const I0 = 70; // m⁻² s⁻¹ sr⁻¹
  let theta = $state(0);
  let area = $state(100); // cm²
  let omega = $state(0.3); // sr
  const rate = $derived(I0 * Math.cos((theta * Math.PI) / 180) ** 2 * (area / 1e4) * omega); // per second
  const horizontal = $derived((Math.PI / 2) * I0); // m⁻² s⁻¹
  const perCm2Min = $derived((horizontal * 60) / 1e4);
  const grid = Array.from({ length: 91 }, (_, i) => i);
  const d = (sx: (v: number) => number, sy: (v: number) => number, f: (t: number) => number) => grid.map((t, i) => `${i ? 'L' : 'M'}${sx(t).toFixed(1)},${sy(f(t)).toFixed(1)}`).join('');
</script>

<Widget title="Muons against the zenith angle" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={theta} min={0} max={85} step={1} label="Detector pointed at zenith angle θ" format={(v) => v.toFixed(0) + '°'} />
    <Slider bind:value={area} min={10} max={1000} step={10} log label="Detector area [cm²]" format={(v) => v.toFixed(0) + ' cm²'} />
    <Slider bind:value={omega} min={0.05} max={1} step={0.05} label="Acceptance (solid angle) [sr]" format={(v) => v.toFixed(2)} />
  {/snippet}
  <Plot
    height={230}
    label="Muon intensity against zenith angle, from 70 per square metre per second per steradian at the zenith, falling as cosine squared to zero at the horizon."
    x={{ domain: [0, 90], label: 'zenith angle θ [degrees]', ticks: 9 }}
    y={{ domain: [0, 80], label: 'I(θ)  [m⁻² s⁻¹ sr⁻¹]', ticks: 4 }}
  >
    {#snippet marks({ sx, sy })}
      <path d={d(sx, sy, (t) => I0 * Math.cos((t * Math.PI) / 180) ** 2)} class="p3-line" stroke="var(--series-1)" />
      <circle cx={sx(theta)} cy={sy(I0 * Math.cos((theta * Math.PI) / 180) ** 2)} r="5" fill="var(--series-7)" />
    {/snippet}
  </Plot>
  <dl class="p3-out ui" aria-live="polite">
    <div><dt>intensity at θ = {theta}°</dt><dd>{(I0 * Math.cos((theta * Math.PI) / 180) ** 2).toFixed(1)} m⁻² s⁻¹ sr⁻¹</dd></div>
    <div><dt>counts in your detector</dt><dd>{(rate * 60).toFixed(2)} per minute ({rate.toFixed(3)} per second)</dd></div>
    <div><dt>horizontal plate, all angles: (π/2) I₀</dt><dd>{horizontal.toFixed(0)} m⁻² s⁻¹ = {perCm2Min.toFixed(2)} cm⁻² min⁻¹</dd></div>
  </dl>
  <p class="p3-note ui">The Particle Data Group quotes the vertical intensity as about 70 m⁻² s⁻¹ sr⁻¹ for muons above 1 GeV at sea level, and the rule of thumb “about 1 per cm² per minute” for a horizontal detector. The cos²θ integral of that intensity is 0.66 cm⁻² min⁻¹, so the round figure is good to a factor of 1.5: a real detector's rate depends on its energy threshold and on the true angular distribution, which is close to cos²θ for muons of a few GeV, steeper below and flatter above.</p>
</Widget>
