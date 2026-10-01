<!--
  Dirac's energy spectrum (Chapter 9): E = ±√(p² + m²), two branches separated by a gap of 2m. A photon can lift an electron from the negative branch
  to the positive one at the same momentum if its energy is at least 2E(p) ≥ 2m; what is left behind is a hole, which behaves as a particle of
  positive energy and opposite charge. The units are the electron mass (m = 1).

    ::dirac-levels{n="9.1" caption="…"}
-->
<script lang="ts">
  import './part3.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { particle } from '$lib/hep/particles';

  let { n, caption }: { n?: string | number; caption?: string } = $props();
  let p = $state(0.8);
  let omega = $state(2.4);
  const me = particle(11).mass * 1000; // MeV
  const E = $derived(Math.sqrt(1 + p * p));
  const need = $derived(2 * E);
  const can = $derived(omega >= need - 1e-9);
  const grid = Array.from({ length: 161 }, (_, i) => -4 + (i * 8) / 160);
  const up = grid.map((q) => ({ q, e: Math.sqrt(1 + q * q) }));
  const dn = grid.map((q) => ({ q, e: -Math.sqrt(1 + q * q) }));
  const path = (a: { q: number; e: number }[], sx: (v: number) => number, sy: (v: number) => number) => a.map((pt, i) => `${i ? 'L' : 'M'}${sx(pt.q).toFixed(1)},${sy(pt.e).toFixed(1)}`).join('');
</script>

<Widget title="Dirac's two branches of energy" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={p} min={0} max={3.5} step={0.05} label="Momentum p of the electron (units of m_e c)" format={(v) => v.toFixed(2)} />
    <Slider bind:value={omega} min={0} max={8} step={0.05} label="Photon energy ħω (units of m_e c² = 0.511 MeV)" format={(v) => v.toFixed(2)} />
  {/snippet}
  <Plot
    height={300}
    label="The energy E of a free electron against momentum p: a branch E = +√(p²+1) above a gap and a branch E = −√(p²+1) below it, in units of the electron mass. An arrow marks the transition of an electron from the lower branch to the upper one at the chosen momentum."
    x={{ domain: [-4, 4], label: 'momentum p  [m c]', ticks: 8 }}
    y={{ domain: [-5, 5], label: 'energy E  [m c²]', ticks: 10 }}
  >
    {#snippet marks({ sx, sy })}
      <rect x="0" width="1000" y={sy(1)} height={sy(-1) - sy(1)} fill="var(--bad-soft)" />
      <text x="8" y={sy(0) + 4} class="p3-tag">no free states: a gap of 2mc² = 1.022 MeV</text>
      <path d={path(up, sx, sy)} class="p3-line" stroke="var(--series-1)" />
      <path d={path(dn, sx, sy)} class="p3-line" stroke="var(--series-2)" />
      <text x={sx(-3.9)} y={sy(4.3)} class="p3-tag">E = +√(p² + m²)</text>
      <text x={sx(-3.9)} y={sy(-4.3)} class="p3-tag">E = −√(p² + m²)</text>
      <line x1={sx(p)} x2={sx(p)} y1={sy(-E)} y2={sy(E)} stroke={can ? 'var(--ok)' : 'var(--ink-3)'} stroke-width="2.5" stroke-dasharray={can ? '0' : '5 4'} />
      <circle cx={sx(p)} cy={sy(-E)} r="6" fill="none" stroke="var(--series-7)" stroke-width="2" />
      <circle cx={sx(p)} cy={sy(E)} r="5" fill="var(--series-1)" />
    {/snippet}
  </Plot>
  <dl class="p3-out ui" aria-live="polite">
    <div><dt>energy needed at this p: 2E</dt><dd>{need.toFixed(2)} m c² = {(need * me).toFixed(3)} MeV</dd></div>
    <div><dt>photon</dt><dd>{(omega * me).toFixed(3)} MeV: {can ? 'lifts the electron: a pair appears' : 'too little: nothing happens'}</dd></div>
    <div><dt>what is left</dt><dd>{can ? 'a hole (open circle) of energy +E and charge +e: a positron' : '—'}</dd></div>
  </dl>
  <p class="p3-note ui">
    The equation has four components at each momentum: two spin states on each branch. Both branches are solutions, and the lower one cannot be thrown away. At p = 0 the gap is exactly 2mc², the smallest photon that can make a pair.
    The picture of a filled “sea” of negative-energy states is Dirac's 1930 interpretation; modern quantum field theory reads the lower branch as the antiparticle moving backwards in time, with the same physical content.
  </p>
</Widget>
