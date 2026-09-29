<!--
  A logic probe: three lamps (HIGH, LOW, PULSE) and two thresholds. Touch its tip to a level, to nothing, or to a
  clock, and see what it reports; the pulse stretcher makes a 100 kHz clock visible where the eye would see only
  a grey blur. Behaviour in probe.ts.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { formatSI } from '$lib/bench/format';
  import { prefersReducedMotion } from '$lib/theme/signals';
  import { FLICKER_HZ, HIGH_ABOVE, LOW_BELOW, classify, lamps, type Source } from './probe';
  import { visibleLoop } from './scope-rig';

  let { n }: { n?: string } = $props();

  let kind = $state<'level' | 'floating' | 'clock'>('level');
  let volts = $state(5);
  let hz = $state(2);
  let duty = $state(0.5);
  let t = $state(0);
  let root: HTMLDivElement | undefined = $state();
  let reduced = $state(false);

  const src = $derived<Source>(kind === 'level' ? { kind, volts } : kind === 'floating' ? { kind } : { kind, hz, duty });
  const l = $derived(lamps(src, t));
  const nb = (s: string) => s.replace(/ /g, ' ');
  const verdict = $derived.by(() => {
    if (kind === 'floating') return 'Nothing connected: the probe has no light to show. (A real CMOS input left floating drifts to either level and may even oscillate, which is why unused inputs are tied down.)';
    if (kind === 'level') {
      const c = classify(volts);
      return c === 'high' ? `${nb(formatSI(volts, 'V', 2))} is above ${nb(formatSI(HIGH_ABOVE, 'V', 2))}: HIGH.` : c === 'low' ? `${nb(formatSI(volts, 'V', 2))} is below ${nb(formatSI(LOW_BELOW, 'V', 2))}: LOW.` : `${nb(formatSI(volts, 'V', 2))} lies between ${nb(formatSI(LOW_BELOW, 'V', 2))} and ${nb(formatSI(HIGH_ABOVE, 'V', 2))}: neither high nor low. The probe shows nothing, and a logic input would be in trouble too.`;
    }
    return hz >= FLICKER_HZ ? 'Too fast to follow: HIGH and LOW share the light in proportion to the time spent in each, and PULSE stays on.' : 'Slow enough to watch. PULSE lights for 100 ms after every edge.';
  });

  onMount(() => {
    reduced = prefersReducedMotion();
    if (!root) return;
    return visibleLoop(root, (dt) => {
      if (kind === 'clock' && hz < FLICKER_HZ && !reduced) t += dt;
    });
  });
</script>

<Widget title="Logic probe" {n} kind="Instrument" caption="Touch the tip to different things. Then choose a clock and raise its frequency past 6 Hz.">
  <div class="lp ui" bind:this={root}>
    <svg viewBox="0 0 320 120" role="img" aria-label="A logic probe with three lamps: HIGH is {l.high > 0.5 ? 'lit' : 'dark'}, LOW is {l.low > 0.5 ? 'lit' : 'dark'}, PULSE is {l.pulse > 0.5 ? 'lit' : 'dark'}">
      <path d="M20 60 H86" class="tip" />
      <path d="M86 40 L86 80 L112 74 L290 74 Q304 74 304 60 Q304 46 290 46 L112 46 Z" class="pen" />
      <circle cx="16" cy="60" r="5" class="pin" />
      {#each [['HIGH', 'high', 150], ['LOW', 'low', 200], ['PULSE', 'pulse', 250]] as [name, key, x] (key)}
        {@const b = l[key as 'high' | 'low' | 'pulse']}
        <circle cx={x} cy="60" r="11" class="lamp {key}" style:--b={b} />
        <text x={x} y="98" text-anchor="middle" class="ln">{name}</text>
      {/each}
    </svg>
    <div class="ctl">
      <Segmented
        size="sm"
        label="What the tip touches"
        bind:value={kind}
        options={[
          { value: 'level', label: 'A voltage' },
          { value: 'floating', label: 'Nothing' },
          { value: 'clock', label: 'A clock' },
        ]}
      />
      {#if kind === 'level'}
        <Slider label="Tip voltage" min={0} max={5} step={0.1} bind:value={volts} format={(v) => nb(formatSI(v, 'V', 2))} />
      {:else if kind === 'clock'}
        <Slider label="Frequency" min={0.5} max={100000} log bind:value={hz} format={(v) => nb(formatSI(v, 'Hz', 2))} />
        <Slider label="Duty cycle" min={0.1} max={0.9} step={0.05} bind:value={duty} format={(v) => `${Math.round(v * 100)} % high`} />
      {/if}
    </div>
    <p class="verdict" role="status">{verdict}</p>
  </div>
</Widget>

<style>
  .lp {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.8rem 1.4rem;
    align-items: center;
  }
  @media (max-width: 700px) {
    .lp {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  svg {
    width: 100%;
    max-width: 360px;
    margin: 0 auto;
    display: block;
    font-family: var(--font-ui);
  }
  .tip {
    stroke: var(--wire);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .pin {
    fill: var(--panel);
    stroke: var(--copper);
    stroke-width: 2.5;
  }
  .pen {
    fill: color-mix(in srgb, var(--copper) 16%, var(--panel));
    stroke: var(--copper);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .lamp {
    fill: color-mix(in srgb, var(--c) calc(var(--b) * 100%), var(--surface-3));
    stroke: var(--line-strong);
    stroke-width: 1.5;
    filter: drop-shadow(0 0 calc(var(--b) * 6px) var(--c));
  }
  .lamp.high {
    --c: var(--sig-x);
  }
  .lamp.low {
    --c: var(--phosphor);
  }
  .lamp.pulse {
    --c: var(--sig-high);
  }
  .ln {
    font-size: 10.5px;
    font-weight: 700;
    fill: var(--ink-2);
    letter-spacing: 0.06em;
    font-family: var(--font-mono);
  }
  .ctl {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  .ctl > :global(.slider) {
    width: 100%;
  }
  .verdict {
    grid-column: 1 / -1;
    margin: 0;
    padding: 0.5rem 0.7rem;
    font-size: 0.86rem;
    line-height: 1.5;
    border-left: 3px solid var(--copper);
    background: var(--copper-soft);
    border-radius: 0 5px 5px 0;
  }
</style>
