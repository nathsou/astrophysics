<!--
  Appendix A's symbol gallery: every component in the catalog, drawn by the bench's own renderer, grouped
  by category, with a search box. Each symbol is a one-component circuit, so what you see here is exactly
  what the bench and the live figures draw.

    ::symbol-gallery{}
-->
<script lang="ts">
  import './appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Schematic from '$lib/bench/Schematic.svelte';
  import { galleryEntries, grouped } from './gallery';

  let { n }: { n?: string | number } = $props();

  const entries = galleryEntries();
  let query = $state('');
  let marks = $state(false);
  const groups = $derived(grouped(entries, query));
  const shown = $derived(groups.reduce((s, g) => s + g.entries.length, 0));
</script>

<Widget title="Symbol gallery" {n} kind="Reference" live={false} caption="Type a word (“nand”, “transistor”, “clock”) to filter. Tick “Mark the pins” to see where wires attach: two-terminal parts have pins at both ends, gates have inputs every 2 grid units.">
  {#snippet controls()}
    <label class="ap-label search">
      <span>Search</span>
      <input class="ap-input" type="search" placeholder="Filter {entries.length} symbols…" bind:value={query} aria-label="Filter symbols" />
    </label>
    <label class="mark"><input type="checkbox" bind:checked={marks} /> Mark the pins</label>
    <span class="count" aria-live="polite">{shown} of {entries.length}</span>
  {/snippet}

  <div class="gallery">
    {#each groups as g (g.id)}
      <section aria-labelledby="sym-{g.id}">
        <h5 id="sym-{g.id}">{g.title} <span class="blurb">{g.blurb}</span></h5>
        <ul class="cards">
          {#each g.entries as e (e.type)}
            <li class="card">
              <div class="sym">
                <Schematic circuit={e.circuit} interactive={false} live={false} scale={1.5} pinMarks={marks} label="Symbol of {e.name}" />
              </div>
              <div class="text">
                <div class="name">{e.name}</div>
                <code class="type">{e.type}</code>
                <p class="desc">{e.description}</p>
                <p class="pins"><span>Pins</span> {e.pins.join(', ')}</p>
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {:else}
      <p class="none">Nothing matches “{query}”.</p>
    {/each}
  </div>
</Widget>

<style>
  .search {
    flex: 1 1 14rem;
    max-width: 22rem;
  }
  .mark {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family: var(--font-ui);
    font-size: 0.84rem;
    color: var(--ink-2);
    align-self: end;
    min-height: 2.1rem;
  }
  .count {
    align-self: end;
    min-height: 2.1rem;
    display: inline-flex;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--mute);
  }
  .gallery {
    padding: 0.4rem 1.1rem 1.2rem;
  }
  h5 {
    margin: 1.4rem 0 0.6rem !important;
    padding: 0 0 0.35rem !important;
    border-bottom: 1px solid var(--line);
    font-family: var(--font-display) !important;
    font-size: 0.98rem !important;
    font-weight: 600 !important;
    color: var(--fg);
  }
  h5::before,
  h5::after {
    display: none !important;
  }
  .blurb {
    display: block;
    font-family: var(--font-ui);
    font-size: 0.8rem;
    font-weight: 400;
    color: var(--mute);
    margin-top: 0.15rem;
  }
  .cards {
    list-style: none;
    margin: 0 !important;
    padding: 0 !important;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 15.5rem), 1fr));
    gap: 0.7rem;
  }
  .card {
    display: grid;
    grid-template-rows: auto 1fr;
    margin: 0 !important;
    padding: 0 !important;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
    min-width: 0;
  }
  .card::marker {
    content: '';
  }
  .sym {
    display: grid;
    place-items: center;
    min-height: 7.5rem;
    padding: 0.7rem;
    background: var(--panel);
    border-bottom: 1px solid var(--line);
    overflow: hidden;
  }
  .sym :global(svg) {
    max-width: 100%;
    height: auto;
  }
  .text {
    padding: 0.55rem 0.75rem 0.7rem;
    min-width: 0;
  }
  .name {
    font-family: var(--font-ui);
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--fg);
    line-height: 1.25;
  }
  .type {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--copper-ink);
    background: none !important;
    border: 0 !important;
    padding: 0 !important;
  }
  .desc {
    margin: 0.35rem 0 0 !important;
    font-family: var(--font-ui);
    font-size: 0.8rem;
    line-height: 1.45;
    color: var(--ink-2);
  }
  .pins {
    margin: 0.4rem 0 0 !important;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--mute);
    overflow-wrap: anywhere;
  }
  .pins span {
    font-family: var(--font-ui);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
    margin-right: 0.3rem;
  }
  .none {
    color: var(--mute);
    font-family: var(--font-ui);
    padding: 1.5rem 0;
  }
</style>
