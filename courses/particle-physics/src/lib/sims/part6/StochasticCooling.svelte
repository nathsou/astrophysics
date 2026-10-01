<!--
  Stochastic cooling (Chapter 23): a toy of Simon van der Meer's method for the antiproton beam of the SppS. 2,000 particles have random transverse
  offsets. Each turn a pick-up measures the average offset of a SAMPLE of s particles and a kicker, further round the ring, corrects every particle of the
  sample by −g times that average; the mixing of the ring then shuffles the particles into new samples. For independent offsets the variance falls
  by 1 − 2g/s + g²/s per turn, best at g = 1. Seeded; the real system works on the continuous signal of a few hundred million particles,
  and its bandwidth sets the sample size.

    ::stochastic-cooling{n="23.4" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { rng } from '$lib/hep/random';
  import { coolingToy } from './electroweak';

  let { n, caption, title = 'Stochastic cooling, in miniature' }: { n?: string | number; caption?: string; title?: string } = $props();

  let s = $state(20);
  let g = $state(1);
  let seed = $state(3);
  const TURNS = 120;
  const run = $derived(coolingToy(rng(seed), 2000, s, g, TURNS));
  const halfTurn = $derived.by(() => {
    const k = run.rms.findIndex((v) => v < 0.5);
    return k < 0 ? null : k;
  });
  const predHalf = $derived.by(() => {
    const f = 1 - (2 * g) / s + (g * g) / s;
    return f >= 1 || f <= 0 ? null : Math.log(0.25) / Math.log(f);
  });
</script>

<Widget {title} {n} {caption} kind="Simulation" onreset={() => { s = 20; g = 1; seed = 3; }}>
  {#snippet controls()}
    <div class="ctl">
      <Slider bind:value={s} min={2} max={200} step={1} label="Particles in a sample, s" format={(v) => v.toFixed(0)} />
      <Slider bind:value={g} min={0} max={2.2} step={0.05} label="Gain g (1 is the best)" format={(v) => v.toFixed(2)} />
      <Button size="sm" onclick={() => (seed = seed + 1)}>New particles (seed {seed})</Button>
    </div>
  {/snippet}
  <Plot x={{ domain: [0, TURNS], label: 'turns' }} y={{ domain: [0, 1.3], label: 'rms offset of the beam (start = 1)' }} height={250} label="The rms of the simulated beam's offsets against the number of turns, with the prediction" crosshair={false}>
    {#snippet marks({ sx, sy })}
      <path d={run.predicted.map((v, i) => `${i ? 'L' : 'M'}${sx(i)},${sy(Math.min(v, 1.3))}`).join('')} fill="none" stroke="var(--ink-3)" stroke-width="1.6" stroke-dasharray="5 3" />
      <path d={run.rms.map((v, i) => `${i ? 'L' : 'M'}${sx(i)},${sy(Math.min(v, 1.3))}`).join('')} fill="none" stroke="var(--series-1)" stroke-width="2.4" />
      <line x1="0" x2={sx(TURNS)} y1={sy(0.5)} y2={sy(0.5)} stroke="var(--line-strong)" stroke-dasharray="2 3" />
    {/snippet}
  </Plot>
  <p class="ui note" aria-live="polite">
    Solid: the simulated beam. Dashed: (1 − 2g/s + g²/s)<sup>turns/2</sup>. The rms falls to half its starting value after {halfTurn === null ? 'more than 120' : halfTurn} turns
    (prediction {predHalf === null ? '—' : predHalf.toFixed(0)}). At g = 1 the variance falls by 1/s per turn, so the cooling time is proportional to the number of particles in a sample: cooling a dense beam is slow, and the remedy is a wider bandwidth, which means smaller samples. With g above 2 the correction overshoots and the beam heats.
  </p>
</Widget>

<style>
  .ctl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
    align-items: end;
  }
  .note {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
