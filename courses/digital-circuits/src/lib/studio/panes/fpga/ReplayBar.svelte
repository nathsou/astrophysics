<!--
  The replay controls under the chip view: a scrubber over the placement trace (the annealer's temperature, cost and
  acceptance, with cells sliding between snapshots on the chip) or over the router's iterations (overused nodes, with
  a congestion heat map on the chip).
-->
<script lang="ts">
  import { placeFrame, placeSeries, routeSeries } from '../../fpga/replay';
  import type { FpgaSession } from '../../fpga/session.svelte';
  import Icon from '../../../components/ui/Icon.svelte';
  import LineChart from './LineChart.svelte';

  let { session, kind }: { session: FpgaSession; kind: 'place' | 'route' } = $props();

  const r = $derived(session.result);
  const rp = $derived(session.replay);
  const frame = $derived(r && kind === 'place' ? placeFrame(r.place, rp.pos) : null);
  const series = $derived(r ? placeSeries(r.place) : null);
  const route = $derived(r ? routeSeries(r.route) : null);
  const iterIndex = $derived(r ? Math.round(rp.pos * Math.max(0, r.route.iterations.length - 1)) : 0);
  const it = $derived(r?.route.iterations[iterIndex]);
  const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toPrecision(2));
  const stepMarker = $derived(frame && r ? frame.stepIndex / Math.max(1, r.place.steps.length - 1) : undefined);

  $effect(() => {
    rp.mode = kind;
  });
  function toggle() {
    if (rp.playing) rp.pause();
    else rp.play(kind === 'place' ? 9 : 6);
  }
  function key(ev: KeyboardEvent) {
    if (!r) return;
    const n = kind === 'place' ? r.place.snapshots.length - 1 : Math.max(1, r.route.iterations.length - 1);
    if (ev.key === 'ArrowLeft') rp.pos = Math.max(0, rp.pos - 1 / n);
    else if (ev.key === 'ArrowRight') rp.pos = Math.min(1, rp.pos + 1 / n);
    else if (ev.key === 'Home') rp.pos = 0;
    else if (ev.key === 'End') rp.pos = 1;
    else return;
    ev.preventDefault();
  }
</script>

<div class="rb ui">
  {#if !r}
    <p class="empty">Fit a design to replay its {kind === 'place' ? 'placement' : 'routing'}.</p>
  {:else}
    <div class="ctl">
      <button type="button" class="play" onclick={toggle} aria-label={rp.playing ? 'Pause' : 'Play'}>
        {#if rp.playing}<span class="pp">❚❚</span>{:else}<Icon name="play" size={12} />{/if}
      </button>
      <input
        type="range"
        min="0"
        max="1000"
        value={Math.round(rp.pos * 1000)}
        oninput={(ev) => {
          rp.pause();
          rp.pos = Number((ev.currentTarget as HTMLInputElement).value) / 1000;
        }}
        onkeydown={key}
        aria-label={kind === 'place' ? 'Placement replay position' : 'Routing replay position'}
        aria-valuetext={kind === 'place' ? `temperature step ${frame?.stepIndex ?? 0} of ${r.place.steps.length}` : `iteration ${it?.iter ?? 0} of ${r.route.iterations.length}`}
      />
      <button type="button" class="btn" onclick={() => ((rp.pos = 0), rp.pause())} title="Back to the start">⏮</button>
      <button type="button" class="btn" onclick={() => ((rp.pos = 1), rp.pause())} title="Jump to the end">⏭</button>
      {#if kind === 'place'}<label class="lk" title="Draw a line from each driver to its sinks"><input type="checkbox" bind:checked={rp.links} /> wires</label>{/if}
    </div>
    {#if kind === 'place' && frame && series}
      <dl class="stats">
        <div><dt>step</dt><dd>{frame.stepIndex + 1}/{r.place.steps.length}</dd></div>
        <div><dt>temperature</dt><dd>{frame.step ? fmt(frame.step.temp) : '—'}</dd></div>
        <div><dt>wirelength</dt><dd>{fmt(frame.bb)} tiles</dd></div>
        <div><dt>accepted</dt><dd>{frame.step ? (frame.step.acceptRate * 100).toFixed(0) : '—'} %</dd></div>
        <div><dt>range limit</dt><dd>{frame.step ? frame.step.rlim.toFixed(1) : '—'}</dd></div>
      </dl>
      <div class="charts">
        <LineChart values={series.temperature.values} label="Temperature" log marker={stepMarker} onscrub={(p) => ((rp.pause(), (rp.pos = session.positionOfStep(Math.round(p * (r.place.steps.length - 1))))))} />
        <LineChart values={series.wirelength.values} label="Wirelength" unit="tiles" colour="var(--phosphor)" marker={stepMarker} onscrub={(p) => ((rp.pause(), (rp.pos = session.positionOfStep(Math.round(p * (r.place.steps.length - 1))))))} />
        <LineChart values={series.acceptance.values} label="Acceptance" unit="%" colour="var(--sig-current)" marker={stepMarker} onscrub={(p) => ((rp.pause(), (rp.pos = session.positionOfStep(Math.round(p * (r.place.steps.length - 1))))))} />
      </div>
    {:else if kind === 'route' && route}
      <dl class="stats">
        <div><dt>iteration</dt><dd>{it?.iter ?? 0}/{r.route.iterations.length}</dd></div>
        <div><dt>overused nodes</dt><dd>{it?.overused ?? 0}</dd></div>
        <div><dt>rerouted nets</dt><dd>{it?.rerouted ?? 0}</dd></div>
        <div><dt>present cost ×</dt><dd>{it ? fmt(it.presFac) : '—'}</dd></div>
      </dl>
      <LineChart values={route.values} label="Overused routing nodes per iteration" bars colour="var(--sig-x)" marker={rp.pos} onscrub={(p) => ((rp.pause(), (rp.pos = p)))} height={60} />
      <p class="help">Red tiles hold routing nodes that more than one net wanted. PathFinder makes them dearer each iteration until every net has a wire of its own.</p>
    {/if}
  {/if}
</div>

<style>
  .rb {
    padding: 0.4rem 0.7rem 0.6rem;
    border-top: 1px solid var(--line);
    background: var(--pn);
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  .empty {
    margin: 0.3rem 0;
    color: var(--mute);
  }
  .ctl {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  input[type='range'] {
    flex: 1;
    accent-color: var(--copper);
    min-width: 5rem;
  }
  .play,
  .btn {
    display: inline-grid;
    place-items: center;
    height: 1.7rem;
    min-width: 1.9rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
    font: inherit;
    padding: 0 0.4rem;
  }
  .play {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .pp {
    font-size: 0.6rem;
    letter-spacing: -0.1em;
  }
  .lk {
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
    font-size: 0.72rem;
    white-space: nowrap;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1rem;
    margin: 0.4rem 0;
  }
  .stats div {
    display: flex;
    gap: 0.35rem;
    align-items: baseline;
  }
  dt {
    font-size: 0.64rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--fg);
  }
  .charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    gap: 0.5rem;
  }
  .help {
    margin: 0.4rem 0 0;
    font-size: 0.72rem;
    color: var(--mute);
  }
</style>
