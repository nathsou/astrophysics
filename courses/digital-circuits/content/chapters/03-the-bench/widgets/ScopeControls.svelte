<!--
  The front-panel knobs of the simulated scope: timebase, volts per division, trigger mode / slope /
  level, run–stop, and the cursors (as sliders, so they work from the keyboard). Which groups appear is
  chosen with the `show*` props, so the same panel serves the scope lab and the chapter 4 labs.
-->
<script lang="ts">
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { formatSI } from '$lib/bench/format';
  import type { Cursors, Slope, TriggerMode } from './scope-model';

  let {
    timebases,
    tbIndex = $bindable(0),
    vdivs = [],
    vdIndex = $bindable(0),
    trigMode = $bindable<TriggerMode>('auto'),
    slope = $bindable<Slope>('rise'),
    level = $bindable(2.5),
    levelRange = [-10, 10],
    cursors = $bindable<Cursors | undefined>(undefined),
    vRange = [-10, 10],
    running = $bindable(true),
    showTimebase = true,
    showVolts = true,
    showTrigger = true,
    showCursors = true,
    showRun = true,
    onarm,
    onautoset,
    tbLabel = 'Timebase',
  }: {
    timebases: number[];
    tbIndex?: number;
    vdivs?: number[];
    vdIndex?: number;
    trigMode?: TriggerMode;
    slope?: Slope;
    level?: number;
    levelRange?: [number, number] | number[];
    cursors?: Cursors | undefined;
    vRange?: [number, number] | number[];
    running?: boolean;
    showTimebase?: boolean;
    showVolts?: boolean;
    showTrigger?: boolean;
    showCursors?: boolean;
    showRun?: boolean;
    onarm?: () => void;
    onautoset?: () => void;
    tbLabel?: string;
  } = $props();
</script>

<div class="panel ui">
  {#if showTimebase || showVolts || showRun}
    <div class="group">
      <h5>Horizontal · Vertical</h5>
      {#if showTimebase}
        <Slider label={tbLabel} min={0} max={timebases.length - 1} step={1} bind:value={tbIndex} format={(v) => `${formatSI(timebases[Math.round(v)] ?? 0, 's', 2)}/div`} />
      {/if}
      {#if showVolts && vdivs.length}
        <Slider label="Volts" min={0} max={vdivs.length - 1} step={1} bind:value={vdIndex} format={(v) => `${formatSI(vdivs[Math.round(v)] ?? 0, 'V', 2)}/div`} />
      {/if}
      <div class="row">
        {#if showRun}
          <Button size="sm" onclick={() => (running = !running)} aria-pressed={!running}>{running ? 'Stop' : 'Run'}</Button>
        {/if}
        {#if onautoset}<Button size="sm" onclick={onautoset} title="Choose a timebase that shows the whole signal">Autoset</Button>{/if}
      </div>
    </div>
  {/if}
  {#if showTrigger}
    <div class="group">
      <h5>Trigger</h5>
      <Segmented
        size="sm"
        label="Trigger mode"
        bind:value={trigMode}
        options={[
          { value: 'off', label: 'Off', title: 'Free run: the sweep starts whenever the last one ended' },
          { value: 'auto', label: 'Auto', title: 'Start each sweep at an edge; free-run if there is none' },
          { value: 'single', label: 'Single', title: 'Wait for one trigger, capture, and hold' },
        ]}
      />
      <Segmented
        size="sm"
        label="Trigger slope"
        bind:value={slope}
        options={[
          { value: 'rise', label: 'Rising ↗' },
          { value: 'fall', label: 'Falling ↘' },
        ]}
      />
      <Slider label="Level" min={levelRange[0]!} max={levelRange[1]!} step={0.05} bind:value={level} format={(v) => formatSI(v, 'V', 3)} />
      {#if trigMode === 'single' && onarm}<Button size="sm" onclick={onarm}>Arm</Button>{/if}
    </div>
  {/if}
  {#if showCursors && cursors}
    <div class="group cur">
      <h5>Cursors</h5>
      <Toggle label="Show cursors" bind:checked={cursors.on} />
      {#if cursors.on}
        <div class="cgrid">
          <Slider compact label="T1" min={0} max={10} step={0.05} bind:value={cursors.t1} format={(v) => `${v.toFixed(2)} div`} />
          <Slider compact label="V1" min={vRange[0]!} max={vRange[1]!} step={0.02} bind:value={cursors.v1} format={(v) => formatSI(v, 'V', 3)} />
          <Slider compact label="T2" min={0} max={10} step={0.05} bind:value={cursors.t2} format={(v) => `${v.toFixed(2)} div`} />
          <Slider compact label="V2" min={vRange[0]!} max={vRange[1]!} step={0.02} bind:value={cursors.v2} format={(v) => formatSI(v, 'V', 3)} />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .panel {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr));
    gap: 0.9rem 1.4rem;
    margin-top: 0.8rem;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    align-items: flex-start;
    min-width: 0;
  }
  .group > :global(.slider) {
    width: 100%;
  }
  h5 {
    margin: 0 0 0.15rem !important;
    padding: 0 !important;
    border: 0 !important;
    font-family: var(--font-mono) !important;
    font-size: 0.66rem !important;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mute);
    font-weight: 500 !important;
  }
  h5::before,
  h5::after {
    display: none !important;
  }
  .cur {
    grid-column: span 2;
  }
  .cgrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.2rem 1.4rem;
    width: 100%;
  }
  @media (max-width: 560px) {
    .cur {
      grid-column: auto;
    }
    .cgrid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .row {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
</style>
