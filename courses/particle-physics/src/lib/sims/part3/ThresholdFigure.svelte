<!--
  Production thresholds (Chapter 9). For a chosen reaction, the centre-of-mass energy √s of a beam of kinetic energy T on a stationary
  target, against the sum of the final masses that √s has to reach. The crossing is the threshold. Two equal beams need far less.
  Everything is computed with hep/kinematics (mandelstamS) in ./threshold.ts.

    ::threshold-figure{n="9.3" caption="…"}
-->
<script lang="ts">
  import './part3.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { REACTIONS, sqrtSFixedTarget, thresholdKineticFixedTarget, thresholdKineticCollider } from './threshold';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let which = $state('antiproton');
  const rx = $derived(REACTIONS.find((r) => r.id === which)!);
  const final = $derived(rx.finals.reduce((a, b) => a + b, 0));
  const Tthr = $derived(thresholdKineticFixedTarget(rx.beam, rx.target, final));
  const Tcoll = $derived(thresholdKineticCollider(rx.beam, final));

  // beam kinetic energy slider on a log axis, in GeV
  let logT = $state(Math.log10(5.63));
  const T = $derived(10 ** logT);
  const sq = $derived(rx.beam > 0 ? sqrtSFixedTarget(rx.beam, rx.target, T) : Math.sqrt(rx.target ** 2 + 2 * rx.target * T));
  const above = $derived(sq >= final);

  const lo = $derived(Tthr / 30);
  const hi = $derived(Tthr * 30);
  const pts = $derived(
    Array.from({ length: 120 }, (_, i) => {
      const t = lo * (hi / lo) ** (i / 119);
      return { t, s: rx.beam > 0 ? sqrtSFixedTarget(rx.beam, rx.target, t) : Math.sqrt(rx.target ** 2 + 2 * rx.target * t) };
    }),
  );
  // collider: two beams each of kinetic energy t: √s = 2 (m + t)
  const coll = $derived(pts.map((p) => ({ t: p.t, s: 2 * (rx.beam + p.t) })));
  const fmt = (x: number) => (x >= 1 ? x.toFixed(3) + ' GeV' : x >= 1e-3 ? (x * 1e3).toFixed(3) + ' MeV' : (x * 1e6).toFixed(1) + ' keV');
  const d = (a: { t: number; s: number }[], sx: (v: number) => number, sy: (v: number) => number) => a.map((p, i) => `${i ? 'L' : 'M'}${sx(p.t).toFixed(1)},${sy(p.s).toFixed(1)}`).join('');
  $effect(() => {
    // keep the slider near the threshold when the reaction changes
    logT = Math.log10(Tthr);
  });
</script>

<Widget title="How much energy does it take?" {n} {caption} kind="Explore">
  {#snippet controls()}
    <div class="p3-chips ui" role="radiogroup" aria-label="Reaction">
      {#each REACTIONS as r (r.id)}
        <button type="button" role="radio" aria-checked={which === r.id} class:on={which === r.id} onclick={() => (which = r.id)}>{r.label}</button>
      {/each}
    </div>
    <Slider bind:value={logT} min={Math.log10(Tthr / 10)} max={Math.log10(Tthr * 10)} step={0.005} label="Beam kinetic energy T" format={(v) => fmt(10 ** v)} />
  {/snippet}
  <Plot
    height={280}
    label="The centre-of-mass energy against the beam kinetic energy, for a fixed target and for colliding beams, on logarithmic axes, with a horizontal line at the sum of the final-state masses."
    x={{ type: 'log', domain: [lo, hi], label: rx.beam > 0 ? 'kinetic energy of the beam particle [GeV] (of each beam, for a collider)' : 'kinetic energy of the photon [GeV]', format: (v) => (v >= 1 ? String(+v.toPrecision(3)) : String(+v.toPrecision(2))), ticks: 6 }}
    y={{ type: 'log', domain: [final / 6, final * 12], label: '√s [GeV]', format: (v) => String(+v.toPrecision(3)) }}
  >
    {#snippet marks({ sx, sy })}
      <line x1="0" x2="1000" y1={sy(final)} y2={sy(final)} stroke="var(--series-7)" stroke-dasharray="6 4" />
      <text x="6" y={sy(final) - 6} class="p3-tag">√s needed = Σ m(final) = {fmt(final)}</text>
      <path d={d(pts, sx, sy)} class="p3-line" stroke="var(--series-1)" />
      {#if rx.beam > 0}<path d={d(coll, sx, sy)} class="p3-line" stroke="var(--series-3)" />{/if}
      <line x1={sx(Tthr)} x2={sx(Tthr)} y1="0" y2="1000" stroke="var(--series-1)" stroke-dasharray="2 3" />
      <circle cx={sx(T)} cy={sy(sq)} r="5" fill={above ? 'var(--ok)' : 'var(--bad)'} />
    {/snippet}
  </Plot>
  <ul class="key ui p3-note">
    <li><span style="color: var(--series-1)">━</span> a stationary target{#if rx.beam === 0}: the beam is a photon{/if}</li>
    {#if rx.beam > 0}<li><span style="color: var(--series-3)">━</span> two equal beams colliding head-on</li>{/if}
  </ul>
  <dl class="p3-out ui" aria-live="polite">
    <div><dt>threshold, stationary target</dt><dd>{fmt(Tthr)}{#if rx.beam > 0} = {(Tthr / rx.beam).toFixed(2)} × m of the beam particle{/if}</dd></div>
    {#if rx.beam > 0}<div><dt>threshold, each of two beams</dt><dd>{fmt(Tcoll)}</dd></div>{/if}
    <div><dt>at T = {fmt(T)}</dt><dd>√s = {fmt(sq)}: {above ? 'the final state is open ✓' : 'not enough: below threshold ✗'}</dd></div>
  </dl>
  <p class="p3-note ui">{rx.note}</p>
</Widget>
