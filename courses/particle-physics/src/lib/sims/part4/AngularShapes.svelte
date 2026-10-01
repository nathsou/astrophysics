<!--
  Chapter 16: the angular distributions of e⁺e⁻ → μ⁺μ⁻ and Bhabha scattering, with Bhabha split into its s-channel,
  t-channel and interference parts (massless electrons, photon exchange, units of πα²/s per unit cos θ).

    ::angular-shapes{n="16.1" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { bhabhaParts } from './shapes';

  let { n, caption, title = 'Two angular distributions' }: { n?: string | number; caption?: string; title?: string } = $props();

  let scale = $state<'log' | 'linear'>('log');
  let showS = $state(true);
  let showT = $state(true);
  let showI = $state(true);
  let showTot = $state(true);

  const N = 181;
  const cs = Array.from({ length: N }, (_, i) => -0.9 + (1.8 * i) / (N - 1));
  const pts = cs.map((c) => ({ c, ...bhabhaParts(c) }));
  const mumu = cs.map((c) => ({ c, y: (1 + c * c) / 2 }));
  const line = (vals: { c: number; y: number }[], sx: (v: number) => number, sy: (v: number) => number) =>
    vals.filter((p) => p.y > 0).map((p, i) => `${i ? 'L' : 'M'}${sx(p.c).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  const yDomain = $derived<[number, number]>(scale === 'log' ? [0.3, 3000] : [0, 40]);
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    <Segmented
      label="Vertical scale"
      size="sm"
      bind:value={scale}
      options={[
        { value: 'log', label: 'logarithmic' },
        { value: 'linear', label: 'linear' },
      ]}
    />
    <Toggle bind:checked={showS} label="s-channel: annihilation (this is also e⁺e⁻ → μ⁺μ⁻)" />
    <Toggle bind:checked={showT} label="t-channel: scattering" />
    <Toggle bind:checked={showI} label="interference" />
    <Toggle bind:checked={showTot} label="Bhabha total" />
  {/snippet}
  <Plot
    height={320}
    label="Angular distribution of Bhabha scattering in its three parts, and of e⁺e⁻ to μ⁺μ⁻, against the cosine of the scattering angle"
    x={{ domain: [-0.9, 0.9], label: 'cos θ  (θ = angle of the outgoing e⁻ to the incoming e⁻)', ticks: 9, format: (v) => v.toFixed(1) }}
    y={{ type: scale, domain: yDomain, label: 'dσ/dcos θ  in units of πα²/s', ticks: 6 }}
  >
    {#snippet marks({ sx, sy })}
      {#if showS}<path d={line(pts.map((p) => ({ c: p.c, y: p.s })), sx, sy)} fill="none" stroke="var(--series-1)" stroke-width="2" />{/if}
      {#if showT}<path d={line(pts.map((p) => ({ c: p.c, y: p.t })), sx, sy)} fill="none" stroke="var(--series-2)" stroke-width="2" stroke-dasharray="7 4" />{/if}
      {#if showI}<path d={line(pts.map((p) => ({ c: p.c, y: Math.abs(p.interference) })), sx, sy)} fill="none" stroke="var(--series-4)" stroke-width="2" stroke-dasharray="2 4" />{/if}
      {#if showTot}<path d={line(pts.map((p) => ({ c: p.c, y: p.total })), sx, sy)} fill="none" stroke="var(--ink)" stroke-width="2.4" />{/if}
    {/snippet}
  </Plot>
  <ul class="key ui">
    <li><span class="sw" style="border-top:3px solid var(--series-1)"></span> s-channel, (1 + cos²θ)/2: no preferred direction beyond the dip at 90°</li>
    <li><span class="sw" style="border-top:3px dashed var(--series-2)"></span> t-channel, (4 + (1 + cos θ)²)/(1 − cos θ)²: the photon exchanged between the electron and the positron, peaked where the electron barely turns</li>
    <li><span class="sw" style="border-top:3px dotted var(--series-4)"></span> interference (absolute value; its sign is negative)</li>
  </ul>
</Widget>

<style>
  .key {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    font-size: 0.78rem;
    color: var(--ink-2);
    display: grid;
    gap: 0.2rem;
  }
  .sw {
    display: inline-block;
    width: 1.8rem;
    margin-right: 0.4rem;
    vertical-align: middle;
  }
</style>
