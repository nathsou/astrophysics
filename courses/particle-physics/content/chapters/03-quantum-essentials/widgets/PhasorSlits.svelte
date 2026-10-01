<!--
  Two paths, two amplitudes. Each path gives the particle an amplitude, drawn as an arrow (a phasor): its length is the path's weight, its
  direction the phase. If nothing records which path was taken, the amplitudes are added as arrows and the sum is squared: |A₁ + A₂|².
  If the path is recorded, the probabilities are added instead: |A₁|² + |A₂|². The phase difference comes from the path difference.

  A calculation with the textbook formula in the far-field limit, not a measurement.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { intensityCoherent, intensityWhichPath, phaseDifference, phasors } from '$lib/sims/part1/phasor';

  let { n, caption, title = 'Adding amplitudes: two paths' }: { n?: string | number; caption?: string; title?: string } = $props();

  let aOverL = $state(4);
  let ratio = $state(1);
  let deg = $state(6); // screen angle
  let whichPath = $state(false);

  const s = $derived({ aOverLambda: aOverL, ratio });
  const th = $derived((deg * Math.PI) / 180);
  const ph = $derived(phasors(s, th));
  const sum = $derived<[number, number]>([ph.a1[0] + ph.a2[0], ph.a1[1] + ph.a2[1]]);
  const I = $derived(whichPath ? intensityWhichPath(s) : intensityCoherent(s, th));
  const delta = $derived(phaseDifference(s, th));
  const maxI = $derived((1 + ratio) ** 2);
  const R = 70;
  const curve = $derived(Array.from({ length: 401 }, (_, i) => { const a = -20 + (40 * i) / 400; return { a, v: whichPath ? intensityWhichPath(s) : intensityCoherent(s, (a * Math.PI) / 180) }; }));
  const deltaDeg = $derived((((delta * 180) / Math.PI) % 360 + 360) % 360);
</script>

<Widget {title} subtitle="Amplitudes add as arrows; then the sum is squared" {n} {caption} kind="Explore" onreset={() => { aOverL = 4; ratio = 1; deg = 6; whichPath = false; }}>
  {#snippet controls()}
    <Slider bind:value={deg} min={-20} max={20} step={0.1} label="Position on the screen (angle)" format={(v) => `${v.toFixed(1)}°`} />
    <Slider bind:value={aOverL} min={1} max={10} step={0.1} label="Slit separation / wavelength" format={(v) => v.toFixed(1)} />
    <Slider bind:value={ratio} min={0.2} max={1} step={0.01} label="Weight of path 2 relative to path 1" format={(v) => v.toFixed(2)} />
    <Toggle bind:checked={whichPath} label="Record which path was taken" />
  {/snippet}

  <div class="cols">
    <div>
      <svg viewBox="-110 -100 220 200" role="img" aria-label="Two arrows, the amplitudes of the two paths, placed head to tail; their sum has length squared equal to the intensity">
        <line x1="-105" x2="105" y1="0" y2="0" stroke="var(--line-strong)" />
        <line x1="0" x2="0" y1="-95" y2="95" stroke="var(--line-strong)" />
        <defs><marker id="pa" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="context-stroke" /></marker></defs>
        <line x1="0" y1="0" x2={ph.a1[0] * R} y2={-ph.a1[1] * R} stroke="var(--series-1)" stroke-width="2.4" marker-end="url(#pa)" />
        <line x1={ph.a1[0] * R} y1={-ph.a1[1] * R} x2={sum[0] * R} y2={-sum[1] * R} stroke="var(--series-4)" stroke-width="2.4" marker-end="url(#pa)" />
        {#if !whichPath}
          <line x1="0" y1="0" x2={sum[0] * R} y2={-sum[1] * R} stroke="var(--sig-high)" stroke-width="3.2" marker-end="url(#pa)" />
        {/if}
        <text x="-104" y="-86" font-size="10" fill="var(--series-1)">A₁ (path 1)</text>
        <text x="-104" y="-74" font-size="10" fill="var(--series-4)">A₂ (path 2)</text>
        {#if !whichPath}<text x="-104" y="-62" font-size="10" fill="var(--sig-high)">A₁ + A₂</text>{/if}
      </svg>
      <p class="ui small" aria-live="polite">
        Phase difference δ = 2π (a/λ) sin θ = {deltaDeg.toFixed(0)}° (mod 360°).
        {#if whichPath}Path recorded: the probabilities add, |A₁|² + |A₂|² = {I.toFixed(2)}, whatever the position.{:else}Intensity |A₁ + A₂|² = <strong>{I.toFixed(2)}</strong> (from 0 to {maxI.toFixed(2)}). {#if Math.abs(ratio - 1) < 0.005 && I < 0.02}The arrows point in opposite directions and cancel: a dark fringe, though each path alone would put particles here.{/if}{/if}
      </p>
    </div>
    <div>
      <Plot
        label="Intensity on the screen against angle: fringes when the path is not recorded, a flat line when it is"
        x={{ domain: [-20, 20], label: 'angle on the screen [degrees]', ticks: 8 }}
        y={{ domain: [0, maxI * 1.08], label: 'intensity (|A₁|² = 1)', ticks: 5 }}
        height={230}
        crosshair={false}
      >
        {#snippet marks({ sx, sy })}
          <path d={curve.map((p, i) => `${i ? 'L' : 'M'}${sx(p.a)} ${sy(p.v)}`).join('')} fill="none" stroke="var(--series-1)" stroke-width="2.2" />
          <line x1={sx(deg)} x2={sx(deg)} y1="0" y2={sy(0)} stroke="var(--sig-high)" stroke-width="1.6" />
          <circle cx={sx(deg)} cy={sy(I)} r="4.5" fill="var(--sig-high)" />
        {/snippet}
      </Plot>
    </div>
  </div>
</Widget>

<style>
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 720px) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  svg {
    width: 100%;
    max-width: 22rem;
    display: block;
    margin: 0 auto;
    background: var(--chart-surface);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .small {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.45;
    margin: 0.4rem 0 0;
  }
</style>
