<!--
  Wire segments of different lengths: the fastest route across a row of tiles, for the wires you allow, with the
  delays of the vFPGA's delay model. Longer wires skip the multiplexers of the tiles they pass.

    ::wire-reach{n="28.3" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { WIRE_SETS, fastest, type Span, type WireSet } from './wire-reach';

  let { n, caption, distance: start = 30, set: startSet = 'one' }: { n?: string | number; caption?: string; distance?: number; set?: string } = $props();

  const WIDTH = 36;
  // svelte-ignore state_referenced_locally
  let distance = $state(start);
  // svelte-ignore state_referenced_locally
  let set = $state<WireSet>(WIRE_SETS.some((s) => s.id === startSet) ? (startSet as WireSet) : 'one');

  const route = $derived(fastest(distance, set, WIDTH));
  const all = $derived(WIRE_SETS.map((s) => ({ ...s, r: fastest(distance, s.id, WIDTH) })));
  const slowest = $derived(Math.max(...all.map((a) => a.r.delay)));

  const X0 = 6;
  const PITCH = 9.6;
  const cx = (t: number) => X0 + t * PITCH + 3.4;
  const BASE = 96;
  const colour: Record<Span, string> = { 1: 'var(--series-2)', 4: 'var(--series-1)', 12: 'var(--series-3)' };
  const arc = (a: number, b: number, span: Span) => {
    const x1 = cx(a);
    const x2 = cx(b);
    const h = span === 1 ? 10 : span === 4 ? 26 : 52;
    const lift = Math.abs(x2 - x1) < 1 ? 0 : h;
    return `M ${x1} ${BASE} C ${x1} ${BASE - lift * 1.35}, ${x2} ${BASE - lift * 1.35}, ${x2} ${BASE}`;
  };
  const lift = (span: Span) => (span === 1 ? 10 : span === 4 ? 26 : 52) * 1.35 * 0.75;
  // The picture is as tall as the longest wire of the set allows, so that it does not jump while the slider moves.
  const top = $derived(BASE - lift(Math.max(...WIRE_SETS.find((x) => x.id === set)!.spans) as Span) - 8);
  const summary = $derived(
    `From tile 0 to tile ${distance}: ${route.hops.length} wire ${route.hops.length === 1 ? 'hop' : 'hops'}, ${route.muxes} multiplexers, ${route.delay.toFixed(1)} nanoseconds.`,
  );
</script>

<Widget {n} title="Wires of different lengths" subtitle="Crossing a row of tiles" {caption} onreset={() => ((distance = start), (set = 'one'))}>
  {#snippet controls()}
    <Segmented label="Wires available" value={set} onchange={(v) => (set = v)} options={WIRE_SETS.map((s) => ({ value: s.id, label: s.label, title: s.title }))} size="sm" />
    <Slider label="Distance (tiles)" bind:value={distance} min={1} max={30} step={1} format={(v) => String(Math.round(v))} compact />
  {/snippet}

  <div class="wr">
    <svg viewBox="0 {top} {X0 * 2 + WIDTH * PITCH - 3} {BASE + 34 - top}" role="img" aria-label={summary}>
      {#each route.hops as h, i (i)}
        <path d={arc(h.from, h.to, h.span)} class="hop" style:stroke={colour[h.span]} />
      {/each}
      {#each Array.from({ length: WIDTH }, (_, t) => t) as t (t)}
        <rect x={X0 + t * PITCH} y={BASE} width="6.8" height="9" rx="1.5" class="tile" class:src={t === 0} class:dst={t === distance} />
      {/each}
      <text x={X0} y={BASE + 20} text-anchor="start" class="lab">driver</text>
      <text x={cx(distance)} y={BASE + (distance < 7 ? 30 : 20)} text-anchor={distance < 7 ? 'start' : 'middle'} class="lab">sink</text>
    </svg>

    <div class="legend ui" aria-hidden="true">
      <span><i style:background={colour[1]}></i>span 1</span>
      <span><i style:background={colour[4]}></i>span 4</span>
      <span><i style:background={colour[12]}></i>span 12</span>
    </div>

    <div class="read ui" role="status">
      <span><b>{route.hops.length}</b> hop{route.hops.length === 1 ? '' : 's'}</span>
      <span><b>{route.muxes}</b> multiplexers</span>
      <span><b>{route.delay.toFixed(1)}</b> ns</span>
    </div>

    <table class="cmp ui" aria-label="Delay with each set of wires">
      <tbody>
        {#each all as a (a.id)}
          <tr class:on={a.id === set}>
            <th scope="row">{a.label}</th>
            <td class="bar"><span style:width="{Math.max(2, (100 * a.r.delay) / slowest)}%"></span></td>
            <td class="v">{a.r.delay.toFixed(1)} ns</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</Widget>

<style>
  .wr {
    display: grid;
    gap: 0.5rem;
    padding: 0.8rem 1rem 1rem;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .tile {
    fill: var(--pn);
    stroke: var(--line-strong);
    stroke-width: 0.8;
  }
  .tile.src,
  .tile.dst {
    fill: var(--copper-soft);
    stroke: var(--copper);
    stroke-width: 1.4;
  }
  .hop {
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  .lab {
    font: 600 6.5px var(--font-mono);
    fill: var(--mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .legend {
    display: flex;
    gap: 1rem;
    font-size: 0.74rem;
    color: var(--mute);
  }
  .legend i {
    display: inline-block;
    width: 1.1rem;
    height: 3px;
    border-radius: 2px;
    margin-right: 0.35rem;
    vertical-align: middle;
  }
  .read {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.4rem;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .read b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .cmp {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .cmp th {
    text-align: left;
    font-weight: 500;
    color: var(--mute);
    padding: 0.15rem 0.6rem 0.15rem 0;
    white-space: nowrap;
  }
  .cmp tr.on th {
    color: var(--fg);
    font-weight: 600;
  }
  .bar {
    width: 100%;
  }
  .bar span {
    display: block;
    height: 0.65rem;
    border-radius: 3px;
    background: var(--line-strong);
  }
  tr.on .bar span {
    background: var(--copper);
  }
  .v {
    font-family: var(--font-mono);
    text-align: right;
    white-space: nowrap;
    padding-left: 0.6rem;
  }
</style>
