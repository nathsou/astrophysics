<!--
  Figure 32.2: one transistor, printed. The reader steps through the eight stages of the self-aligned process and can
  slide the mask sideways to see that the source and drain follow the gate.

    ::litho-steps{n="32.2" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { HEIGHT, WIDTH, buildSteps, type LayerKind } from './litho';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let idx = $state(0);
  let shift = $state(0);
  const gate = $derived({ x0: 40 + shift, x1: 60 + shift });
  const steps = $derived(buildSteps(gate));
  const step = $derived(steps[idx]!);

  const NAMES: Record<LayerKind, string> = {
    silicon: 'p-type silicon',
    oxide: 'gate oxide',
    poly: 'polysilicon (gate)',
    resist: 'photoresist',
    exposed: 'exposed resist',
    implant: 'n-type (source, drain)',
    dielectric: 'glass',
    metal: 'metal',
    chrome: 'chrome on the mask',
  };
  const present = $derived([...new Set(step.layers.map((l) => l.kind))]);
  const uid = $props.id();
</script>

<Widget {n} title="One transistor, printed" subtitle="The eight steps that put an n-channel MOSFET on a wafer" kind="Interactive" {caption} onreset={() => ((idx = 0), (shift = 0))}>
  {#snippet controls()}
    <Button size="sm" onclick={() => (idx = Math.max(0, idx - 1))} disabled={idx === 0}>Back</Button>
    <Slider label="Step" bind:value={idx} min={0} max={steps.length - 1} step={1} format={(v) => `${v + 1} of ${steps.length}`} />
    <Button size="sm" variant="primary" onclick={() => (idx = Math.min(steps.length - 1, idx + 1))} disabled={idx === steps.length - 1}>Next</Button>
    <Slider label="Slide the mask" bind:value={shift} min={-25} max={25} step={1} format={(v) => (v === 0 ? 'centred' : v > 0 ? `${v} to the right` : `${-v} to the left`)} />
  {/snippet}

  <div class="ls">
    <svg viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label="Cross-section of the wafer at step {idx + 1}: {step.title}. Layers: {present.map((k) => NAMES[k]).join(', ')}.">
      <defs>
        <pattern id="hatch-{uid}" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="3" stroke="var(--series-4)" stroke-width="1" />
        </pattern>
      </defs>
      {#if step.light}
        {#each [14, 24, 34, 44, 54, 64, 74, 84, 94] as x (x)}
          {@const blocked = x > gate.x0 && x < gate.x1}
          {#if !blocked}
            <line class="ray" x1={x} x2={x} y1="0" y2="16.5" />
            <path class="rayhead" d="M{x - 1.2} 15.2 L{x} 17 L{x + 1.2} 15.2" />
          {:else}
            <line class="ray blocked" x1={x} x2={x} y1="0" y2="3.6" />
          {/if}
        {/each}
        <text class="cap" x="1" y="3">UV light</text>
      {/if}
      {#if step.mask}
        <rect class="glass" x="0" y="4" width={WIDTH} height="2" />
      {/if}
      {#each step.layers as l, i (i)}
        <rect class="l {l.kind}" x={l.x0} y={l.y0} width={l.x1 - l.x0} height={l.y1 - l.y0} fill={l.kind === 'exposed' ? `url(#hatch-${uid})` : undefined} />
      {/each}
      {#if step.mask}<text class="cap on" x={gate.x0 + (gate.x1 - gate.x0) / 2} y="5.9" text-anchor="middle">mask</text>{/if}
      {#if idx >= 6}
        <text class="cap on" x={(gate.x0 + gate.x1) / 2} y="49" text-anchor="middle">channel</text>
        <text class="cap on" x={Math.max(8, gate.x0 / 2 - 2)} y="41.5" text-anchor="middle">source</text>
        <text class="cap on" x={Math.min(92, (gate.x1 + WIDTH) / 2 + 2)} y="41.5" text-anchor="middle">drain</text>
      {/if}
    </svg>

    <div class="txt ui" aria-live="polite">
      <h5><span class="num">{idx + 1}</span> {step.title}</h5>
      <p>{step.text}</p>
      <ul class="key">
        {#each present as k (k)}<li class={k}><span class="sw"></span>{NAMES[k]}</li>{/each}
      </ul>
    </div>
  </div>
</Widget>

<style>
  .ls {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 1rem 1.4rem;
    align-items: start;
  }
  @media (max-width: 40rem) {
    .ls {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    font-family: var(--font-ui);
  }
  .l {
    stroke: var(--line-strong);
    stroke-width: 0.15;
  }
  .l.silicon,
  .key .silicon .sw {
    fill: var(--silicon);
    background: var(--silicon);
  }
  .l.oxide,
  .key .oxide .sw {
    fill: var(--c-note);
    background: var(--c-note);
  }
  .l.poly,
  .key .poly .sw {
    fill: var(--series-2);
    background: var(--series-2);
  }
  .l.resist,
  .key .resist .sw {
    fill: var(--series-4);
    fill-opacity: 0.85;
    background: var(--series-4);
  }
  .l.exposed {
    fill-opacity: 1;
    stroke: var(--series-4);
    stroke-width: 0.25;
  }
  .key .exposed .sw {
    background: repeating-linear-gradient(45deg, var(--series-4) 0 2px, transparent 2px 4px);
    border: 1px solid var(--series-4);
  }
  .l.implant,
  .key .implant .sw {
    fill: var(--series-1);
    background: var(--series-1);
  }
  .l.dielectric,
  .key .dielectric .sw {
    fill: var(--c-note);
    fill-opacity: 0.3;
    background: color-mix(in srgb, var(--c-note) 30%, transparent);
    border: 1px solid var(--c-note);
  }
  .l.metal,
  .key .metal .sw {
    fill: var(--silicon-metal);
    background: var(--silicon-metal);
  }
  .l.chrome,
  .key .chrome .sw {
    fill: var(--fg);
    background: var(--fg);
  }
  .glass {
    fill: var(--c-note);
    fill-opacity: 0.25;
  }
  .ray {
    stroke: var(--sig-high);
    stroke-width: 0.7;
  }
  .ray.blocked {
    opacity: 0.5;
  }
  .rayhead {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 0.7;
  }
  .cap {
    font-size: 2.9px;
    fill: var(--ink-2);
    font-weight: 600;
  }
  .cap.on {
    fill: var(--panel);
    font-size: 2.6px;
  }
  h5 {
    margin: 0 0 0.3rem !important;
    font-family: var(--font-display);
    font-size: 1rem;
    color: var(--fg);
  }
  .num {
    display: inline-grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    margin-right: 0.3rem;
    border-radius: 50%;
    background: var(--copper);
    color: var(--panel);
    font-size: 0.8rem;
    font-family: var(--font-mono);
  }
  .txt p {
    margin: 0 0 0.6rem;
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.9rem;
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  .key li {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0;
  }
  .sw {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 2px;
    display: inline-block;
  }
</style>
