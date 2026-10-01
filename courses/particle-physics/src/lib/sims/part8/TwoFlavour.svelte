<!--
  Two flavours: P = sin²2θ sin²(1.267 Δm² L/E). The curve is computed by `probability` from hep/oscillations through the hook
  `oscillations.probability`, so if the reader has solved the chapter's exercise and "use my code" is on, it is the reader's function that draws it.

    ::two-flavour{n="31.2" caption="…"}     Props: `n`, `caption`, `title`.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import LinePlot from './LinePlot.svelte';
  import { probability, phase, oscillationLength, OSC_PHASE_CONSTANT } from '$lib/hep/oscillations';
  import { applyMine, listMine } from '$lib/code/apply';
  import { linspace, sig, sci } from './format';

  let { n, caption, title = 'Two flavours: the formula in action' }: { n?: string | number; caption?: string; title?: string } = $props();

  let sin22 = $state(0.95);
  let dm2 = $state(2.5e-3);
  let E = $state(1);
  let mine = $state<{ hook: string; exercise: string; enabled: boolean }[]>([]);
  let useMine = $state(true);
  onMount(() => {
    mine = listMine().filter((m) => m.hook === 'oscillations.probability');
  });

  const theta = $derived(0.5 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, sin22)))));
  const Lmax = 3000;
  const xs = linspace(0, Lmax, 600);
  const result = $derived.by(() => {
    let note: string;
    if (useMine && mine.some((m) => m.enabled)) {
      const a = applyMine();
      const err = a.errors['oscillations.probability'];
      note = err ? `Your code failed to load (${err}); showing the library's.` : a.active.includes('oscillations.probability') ? 'Computed with your code.' : 'Computed with the library.';
    } else {
      applyMine();
      note = 'Computed with the library.';
    }
    const ys = xs.map((L) => {
      const v = probability(theta, dm2, L, E);
      return Number.isFinite(v) ? v : 0;
    });
    return { ys, note };
  });
  const lOsc = $derived(oscillationLength(dm2, E));
  const lMax = $derived(lOsc / 2);
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={sin22} min={0} max={1} step={0.01} label="sin²2θ" format={(v) => v.toFixed(2)} />
    <Slider bind:value={dm2} min={1e-4} max={1e-2} log label="Δm² [eV²]" format={(v) => sci(v, 2)} />
    <Slider bind:value={E} min={0.1} max={30} log label="Energy E [GeV]" format={(v) => sig(v, 3)} />
    {#if mine.length}<label class="ui ctl"><input type="checkbox" bind:checked={useMine} /> use my code</label>{/if}
  {/snippet}
  <LinePlot
    lines={[{ x: xs, y: result.ys, label: 'P(ν_α → ν_β)', color: 'var(--series-1)' }]}
    x={{ domain: [0, Lmax], label: 'distance travelled L [km]' }}
    y={{ domain: [0, 1.02], label: 'probability of the change' }}
    hmarks={[{ value: sin22, label: `sin²2θ = ${sin22.toFixed(2)}: the largest possible probability`, color: 'var(--series-5)' }]}
    vmarks={lMax <= Lmax ? [{ value: lMax, label: 'first maximum', color: 'var(--mute)' }] : []}
    height={260}
    label="Two-flavour oscillation probability against distance"
    format={(v) => sig(v, 3)}
  />
  <p class="ui out" aria-live="polite">
    Phase = {sig(OSC_PHASE_CONSTANT, 4)} Δm² L/E. The first maximum is at L = {sig(lMax, 3)} km and the pattern repeats every {sig(lOsc, 3)} km. At L = 100 km the phase is {sig(phase(dm2, 100, E), 3)} rad.
    <span class="note">{result.note}</span>
  </p>
</Widget>

<style>
  .ctl {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.8rem;
  }
  .out {
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  .note {
    display: block;
    color: var(--mute);
    font-size: 0.75rem;
    margin-top: 0.15rem;
  }
</style>
