<!--
  The parts palette: every catalog component, grouped by category, with a search box. Click a part to
  place copies with the pointer (Esc stops), drag it onto the canvas, or press Enter on it to put one in
  the middle of the view.
-->
<script lang="ts">
  import Schematic from '../Schematic.svelte';
  import { allDefs } from '../../sim/netlist/catalog';
  import type { Category, Circuit, ComponentDef } from '../../sim/netlist/types';
  import Glyph from './Glyph.svelte';
  import type { Bench } from './bench.svelte';

  let { bench, onplace, onpicked }: { bench: Bench; onplace: (type: string) => void; onpicked?: () => void } = $props();

  const GROUPS: { category: Category; title: string }[] = [
    { category: 'source', title: 'Sources' },
    { category: 'passive', title: 'Passive parts' },
    { category: 'switch', title: 'Switches' },
    { category: 'electromechanical', title: 'Electromechanical' },
    { category: 'semiconductor', title: 'Semiconductors' },
    { category: 'meter', title: 'Meters' },
    { category: 'gate', title: 'Logic gates' },
    { category: 'sequential', title: 'Latches and flip-flops' },
    { category: 'block', title: 'Blocks' },
    { category: 'io', title: 'Inputs and outputs' },
    { category: 'wiring', title: 'Ground, rails and labels' },
  ];

  let query = $state('');
  const defs = allDefs();
  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return GROUPS.map((g) => ({
      ...g,
      items: defs.filter((d) => d.category === g.category && (!q || `${d.name} ${d.type} ${d.description ?? ''} ${g.title}`.toLowerCase().includes(q))),
    })).filter((g) => g.items.length);
  });
  const total = $derived(groups.reduce((n, g) => n + g.items.length, 0));

  const previews = new Map<string, Circuit>();
  function preview(d: ComponentDef): Circuit {
    let c = previews.get(d.type);
    if (!c) {
      c = { version: 1, components: [{ id: 'X', type: d.type, x: 0, y: 0, label: '' }], wires: [] };
      previews.set(d.type, c);
    }
    return c;
  }

  function choose(ev: MouseEvent, d: ComponentDef) {
    // Enter or Space on the button arrives as a click with no pointer: place at once.
    if (ev.detail === 0) {
      onplace(d.type);
      onpicked?.();
      return;
    }
    bench.tool = 'select';
    bench.placing = bench.placing === d.type ? null : d.type;
    if (bench.placing) onpicked?.();
  }

  function dragStart(ev: DragEvent, d: ComponentDef) {
    ev.dataTransfer?.setData('application/x-dc-part', d.type);
    ev.dataTransfer?.setData('text/plain', d.name);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy';
    bench.placing = null;
    onpicked?.();
  }
</script>

<div class="palette ui">
  <div class="search">
    <Glyph name="search" size={15} />
    <input type="search" placeholder="Search parts" bind:value={query} aria-label="Search parts" autocomplete="off" spellcheck="false" />
  </div>
  <div class="list" role="list">
    {#each groups as g (g.category)}
      <section class="group" aria-label={g.title}>
        <h3 class="label-caps">{g.title}<span class="n">{g.items.length}</span></h3>
        <ul>
          {#each g.items as d (d.type)}
            <li>
              <button
                type="button"
                class="part"
                class:on={bench.placing === d.type}
                draggable="true"
                title={d.description}
                onclick={(ev) => choose(ev, d)}
                ondragstart={(ev) => dragStart(ev, d)}
                aria-pressed={bench.placing === d.type}
              >
                <span class="thumb" aria-hidden="true"><Schematic circuit={preview(d)} scale={0.8} interactive={false} live={false} /></span>
                <span class="name">{d.name}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {:else}
      <p class="none">No part matches “{query}”.</p>
    {/each}
  </div>
  <p class="foot">{total} parts. Click to place, drag to the canvas, or press Enter.</p>
</div>

<style>
  .palette {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    font-size: 0.82rem;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0.7rem 0.7rem 0.5rem;
    padding: 0 0.6rem;
    height: 2.1rem;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--bg);
    color: var(--mute);
  }
  .search:focus-within {
    border-color: var(--focus);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus) 25%, transparent);
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    outline: none;
    font: inherit;
    color: var(--fg);
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 0.7rem 0.6rem;
    scrollbar-width: thin;
  }
  .group h3 {
    display: flex;
    justify-content: space-between;
    margin: 0.9rem 0 0.4rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--line);
    font-size: 0.64rem;
    color: var(--mute);
  }
  .group .n {
    font-weight: 400;
    opacity: 0.7;
  }
  ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6.1rem, 1fr));
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .part {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    height: 100%;
    gap: 0.2rem;
    padding: 0.3rem 0.3rem 0.4rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
    color: var(--ink-2);
    cursor: pointer;
    text-align: center;
    transition: border-color 120ms, background-color 120ms, box-shadow 120ms;
  }
  .part:hover {
    border-color: var(--copper);
    color: var(--fg);
  }
  .part.on {
    border-color: var(--focus);
    background: color-mix(in srgb, var(--focus) 8%, var(--panel));
    box-shadow: 0 0 0 1px var(--focus);
    color: var(--fg);
  }
  .thumb {
    display: grid;
    place-items: center;
    height: 3.1rem;
    overflow: hidden;
    border-radius: 5px;
    background: var(--bg);
  }
  .thumb :global(.sch-wrap) {
    max-width: 100%;
    max-height: 100%;
    display: grid;
    place-items: center;
  }
  .thumb :global(.sch) {
    max-width: 100%;
    max-height: 3rem;
  }
  .name {
    font-size: 0.72rem;
    line-height: 1.2;
    text-wrap: balance;
  }
  .none {
    margin: 1.5rem 0;
    text-align: center;
    color: var(--mute);
  }
  .foot {
    margin: 0;
    padding: 0.5rem 0.8rem;
    border-top: 1px solid var(--line);
    font-size: 0.7rem;
    color: var(--mute);
  }
</style>
