<!--
  The logic view: the fitted network as a two-level circuit on the bench's schematic renderer, running on
  the digital engine. Toggling an input here toggles it on the device (and vice versa); the clock button
  clocks both. Selecting or hovering a gate cross-probes the chip; the reverse highlights gates here.
  The levels on the output LEDs are reported to the Studio, which compares them with the device's.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Schematic from '../../bench/Schematic.svelte';
  import { buildModel } from '../../bench/model';
  import { connect } from '../../sim/netlist/connect';
  import { flatten } from '../../sim/netlist/flatten';
  import { createDigitalEngine, type DigitalEngine } from '../../sim/digital';
  import type { ParamValue } from '../../sim/netlist/types';
  import type { Studio, LogicLevel } from '../studio.svelte';
  import { buildLogicView, highlightIds } from '../logic-view';
  import Icon from '../../components/ui/Icon.svelte';

  let { studio }: { studio: Studio } = $props();

  const view = $derived(studio.fit ? buildLogicView(studio.fit.network, { inputs: untrack(() => studio.inputs) }) : null);
  const model = $derived(view ? buildModel(view.circuit) : null);
  const boxes = $derived(new Map((model?.comps ?? []).map((m) => [m.c.id, m.box])));
  const selIds = $derived(view ? highlightIds(view, studio.probe) : new Set<string>());
  const hovIds = $derived(view ? highlightIds(view, studio.hoverProbe) : new Set<string>());
  const idToName = $derived.by(() => {
    const m = new Map<string, string>();
    view?.inputComp.forEach((id, name) => m.set(id, name));
    return m;
  });

  let engine = $state.raw<DigitalEngine | null>(null);
  let engineError = $state('');
  let schematic: Schematic | undefined = $state();
  let host: HTMLDivElement | undefined = $state();
  let hostW = $state(600);
  let zoom = $state<number | null>(null);
  const fitScale = $derived(model ? Math.max(0.6, Math.min(1.6, (hostW - 24) / (model.viewBox.x1 - model.viewBox.x0))) : 1);
  const scale = $derived(zoom ?? fitScale);

  let applied: Record<string, number> = {};
  let seenClocks = 0;
  let fromSchematic = false;

  // A new circuit, a new engine.
  $effect(() => {
    const v = view;
    if (!v || typeof window === 'undefined') return;
    let cancelled = false;
    engineError = '';
    try {
      const e = createDigitalEngine(flatten(v.circuit));
      e.settle();
      e.advance(1e-6);
      applied = untrack(() => ({ ...studio.inputs }));
      seenClocks = untrack(() => studio.run?.clocks ?? 0);
      if (!cancelled) engine = e;
    } catch (err) {
      engineError = err instanceof Error ? err.message : String(err);
      engine = null;
    }
    return () => {
      cancelled = true;
    };
  });

  const conn = $derived(view ? connect(view.circuit) : null);

  function levels(): Record<string, LogicLevel> {
    const out: Record<string, LogicLevel> = {};
    const e = engine;
    const v = view;
    if (!e || !v || !conn) return out;
    for (const [name, id] of v.led) {
      const n = conn.pinNet.get(`${id}.A`);
      if (n === undefined) continue;
      const l = e.logic(e.netlist.alias?.[n] ?? n);
      out[name] = l === 0 ? 0 : l === 1 ? 1 : l === 3 ? 'z' : 'x';
    }
    return out;
  }

  function refresh() {
    schematic?.frame(0);
    studio.reportLogic(levels());
    const m = engine?.messages;
    engineError = m && m.length ? (m[m.length - 1]?.text ?? '') : '';
  }

  // The device's inputs and clock drive the engine.
  $effect(() => {
    const e = engine;
    const v = view;
    const inputs = studio.inputs;
    const clocks = studio.run?.clocks ?? 0;
    if (!e || !v) return;
    untrack(() => {
      for (const [name, id] of v.inputComp) {
        if (name === (studio.fit?.network.clock ?? '')) continue;
        const want = inputs[name] ? 1 : 0;
        if ((applied[name] ?? 0) !== want) {
          e.setParam(id, 'on', !!want);
          applied[name] = want;
        }
      }
      e.advance(1e-6);
      if (clocks < seenClocks) {
        e.reset();
        for (const [name, id] of v.inputComp) if (name !== studio.fit?.network.clock) e.setParam(id, 'on', !!inputs[name]);
        e.advance(1e-6);
      } else if (clocks > seenClocks && !fromSchematic && v.clockComp) {
        e.setParam(v.clockComp, 'pressed', true);
        e.advance(60e-9);
        e.setParam(v.clockComp, 'pressed', false);
        e.advance(1e-6);
      }
      seenClocks = clocks;
      fromSchematic = false;
      refresh();
    });
  });

  function onparam(id: string, key: string, value: ParamValue) {
    const v = view;
    if (!v) return;
    if (key === 'on') {
      const name = idToName.get(id);
      if (name !== undefined) {
        applied[name] = value ? 1 : 0;
        studio.setInput(name, value ? 1 : 0);
      }
    } else if (key === 'pressed' && id === v.clockComp) {
      if (value) {
        fromSchematic = true;
        studio.clock();
      } else engine?.advance(1e-6);
    }
    engine?.advance(1e-6);
    refresh();
  }

  function compAt(ev: Event) {
    const g = (ev.target as Element | null)?.closest?.('g.comp');
    const cid = g ? Number((g as SVGGElement).dataset.cid) : NaN;
    if (Number.isNaN(cid) || !view) return null;
    const id = view.circuit.components[cid]?.id;
    return id ? view.refs.get(id) : undefined;
  }
  function onclick(ev: MouseEvent) {
    const r = compAt(ev);
    if (r && r.kind !== 'signal') studio.select(r);
  }
  function onover(ev: PointerEvent) {
    const r = compAt(ev);
    studio.hover(r && r.kind !== 'signal' ? r : null);
  }

  onMount(() => {
    const ro = new ResizeObserver(() => {
      if (host && host.clientWidth > 4) hostW = host.clientWidth;
    });
    if (host) ro.observe(host);
    return () => ro.disconnect();
  });

  const box = (id: string) => boxes.get(id);
  const hostH = $derived(model ? (model.viewBox.y1 - model.viewBox.y0) * scale : 100);
</script>

<div class="logic">
  <div class="bar ui">
    <span class="info">{view ? `${view.stats.gates} gates` : ''}</span>
    <span class="grow"></span>
    <button type="button" onclick={() => (zoom = Math.min(3, (zoom ?? fitScale) * 1.25))} aria-label="Zoom in">+</button>
    <button type="button" onclick={() => (zoom = Math.max(0.25, (zoom ?? fitScale) / 1.25))} aria-label="Zoom out">−</button>
    <button type="button" onclick={() => (zoom = null)} aria-label="Fit to width"><Icon name="fullscreen" size={13} /></button>
  </div>
  <div class="host grid-paper" bind:this={host}>
    {#if view && model}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="stage" style:width="{(model.viewBox.x1 - model.viewBox.x0) * scale}px" style:height="{hostH}px" {onclick} onpointerover={onover} onpointerleave={() => studio.hover(null)}>
        {#key view}
          <Schematic bind:this={schematic} circuit={view.circuit} {engine} mode="logic" {scale} live={false} {onparam} label="Logic view of {studio.fit?.title ?? 'the design'}" />
        {/key}
        <svg class="ov" viewBox="{model.viewBox.x0} {model.viewBox.y0} {model.viewBox.x1 - model.viewBox.x0} {model.viewBox.y1 - model.viewBox.y0}" aria-hidden="true">
          {#each [...hovIds].filter((i) => !selIds.has(i)) as id (id)}
            {@const b = box(id)}
            {#if b}<rect x={b.x0 - 3} y={b.y0 - 3} width={b.x1 - b.x0 + 6} height={b.y1 - b.y0 + 6} rx="4" class="hov" />{/if}
          {/each}
          {#each [...selIds] as id (id)}
            {@const b = box(id)}
            {#if b}<rect x={b.x0 - 3} y={b.y0 - 3} width={b.x1 - b.x0 + 6} height={b.y1 - b.y0 + 6} rx="4" class="sel" />{/if}
          {/each}
        </svg>
      </div>
    {:else}
      <p class="empty ui">No design to draw yet.</p>
    {/if}
  </div>
  {#if engineError}<p class="err ui" role="status">{engineError}</p>{/if}
</div>

<style>
  .logic {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--panel);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid var(--line);
    font-size: 0.74rem;
    color: var(--mute);
  }
  .grow {
    flex: 1;
  }
  .bar button {
    width: 1.6rem;
    height: 1.6rem;
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 0;
  }
  .bar button:hover {
    border-color: var(--copper);
  }
  .host {
    flex: 1;
    min-height: 8rem;
    overflow: auto;
    padding: 0.5rem;
  }
  .stage {
    position: relative;
  }
  .stage :global(.sch-wrap) {
    position: absolute;
    left: 0;
    top: 0;
  }
  .ov {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }
  .sel {
    fill: color-mix(in srgb, var(--phosphor) 14%, transparent);
    stroke: var(--phosphor);
    stroke-width: 1.6;
  }
  .hov {
    fill: color-mix(in srgb, var(--copper) 12%, transparent);
    stroke: var(--copper);
    stroke-width: 1.2;
    stroke-dasharray: 4 3;
  }
  .empty,
  .err {
    margin: 0.5rem;
    color: var(--mute);
    font-size: 0.8rem;
  }
  .err {
    color: var(--bad);
  }
</style>
