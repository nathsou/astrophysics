<!--
  The consolidated bill of materials: every part named by any lab, grouped, with the quantity for one lab at a time
  (the most any single lab needs), the quantity for the labs of Parts I to IV (the minimal kit), and the chapters that
  use it. Tick what you already own; the list of labs above says which labs that is enough for.

    ::bill-of-materials{n="D.2"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import { findEntry } from '$lib/content/registry';
  import { GROUPS, bill, kinds, nb, type Line } from './bom';
  import { owned, loadKit, setOwned, toggleOwned } from './kit.svelte';
  import { LABS } from './labs';

  let { n }: { n?: string | number } = $props();

  type View = 'all' | 'minimal';
  let view = $state<View>('all');
  onMount(loadKit);

  const lines = bill(LABS);
  const groups = GROUPS.map((g) => ({ ...g, lines: lines.filter((l) => l.row.group === g.id && l.all > 0) })).filter((g) => g.lines.length);
  const visible = (g: { lines: Line[] }) => (view === 'minimal' ? g.lines.filter((l) => l.minimal > 0) : g.lines);
  const minimalIds = lines.filter((l) => l.minimal > 0).map((l) => l.row.id);

  const qty = (l: Line, which: 'all' | 'minimal') => (l[which] === 0 ? '–' : l.row.software ? 'free' : l.row.assorted ? 'some' : String(l[which]));
  const chapterHref = (slug: string) => {
    const e = findEntry('chapter', slug);
    return e?.available ? `${base}${e.href}` : undefined;
  };
  const have = $derived(minimalIds.filter((id) => owned.has(id)).length);
</script>

<Widget
  title="Bill of materials"
  {n}
  kind="Reference"
  live={false}
  caption="Every part named in the parts list of any lab, once. “All labs” is the most that any single lab needs (build a lab, take it apart, build the next). “Minimal” is the same for the labs of Parts I to IV, Chapters 1 to 20. Software has no quantity. The tick boxes are remembered in this browser only."
>
  {#snippet controls()}
    <Segmented
      label="Which parts to show"
      size="sm"
      bind:value={view}
      options={[
        { value: 'all', label: `All labs (${kinds(lines, 'all')} kinds)` },
        { value: 'minimal', label: `Minimal kit (${kinds(lines, 'minimal')} kinds)` },
      ]}
    />
  {/snippet}
  {#snippet actions()}
    <button class="w-action" type="button" onclick={() => setOwned(minimalIds, true)}>I have the minimal kit</button>
    <button class="w-action" type="button" disabled={owned.size === 0} onclick={() => setOwned([...owned], false)}>Clear ticks</button>
  {/snippet}

  <div class="bom ui">
    <p class="sum" aria-live="polite">
      {#if owned.size}You have ticked {owned.size} {owned.size === 1 ? 'kind' : 'kinds'} of part, {have} of the {minimalIds.length} in the minimal kit.{:else}Tick a part you already own to see which labs you can build.{/if}
    </p>
    {#each groups as g (g.id)}
      {@const rows = visible(g)}
      {#if rows.length}
        <section aria-labelledby="bomg-{g.id}">
          <h5 id="bomg-{g.id}">{g.title}</h5>
          <p class="blurb">{g.blurb}</p>
          <div class="head" aria-hidden="true"><span>Have</span><span>Part</span><span class="hch">Chapters</span><span>All labs</span><span>Minimal</span></div>
          <ul>
            {#each rows as l (l.row.id)}
              {@const id = `bom-${l.row.id}`}
              <li class:got={owned.has(l.row.id)}>
                <input {id} type="checkbox" checked={owned.has(l.row.id)} onchange={() => toggleOwned(l.row.id)} />
                <label for={id}>
                  <span class="name">{nb(l.row.name)}</span>
                  {#if l.row.detail}<span class="detail">{nb(l.row.detail)}</span>{/if}
                </label>
                <span class="q" title="The most any single lab needs">{qty(l, 'all')}</span>
                <span class="q min" title="For the labs of Parts I to IV">{qty(l, 'minimal')}</span>
                <span class="uses">
                  <span class="lbl">Chapters</span>
                  {#each l.uses as u, i (u.chapter)}{@const h = chapterHref(u.chapter)}{i ? ', ' : ' '}{#if h}<a href={h} title={u.count > 1 ? `${u.count} needed in Chapter ${u.number}` : undefined}>{u.number}</a>{:else}{u.number}{/if}{/each}
                </span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}
  </div>
</Widget>

<style>
  .bom {
    padding: 0.9rem 1.1rem 1.2rem;
  }
  .sum {
    margin: 0 0 0.4rem !important;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  h5 {
    margin: 1.4rem 0 0.15rem !important;
    padding: 0 0 0.25rem !important;
    border: 0 !important;
    border-bottom: 2px solid var(--copper) !important;
    font-family: var(--font-display) !important;
    font-size: 1rem !important;
  }
  h5::before,
  h5::after {
    display: none !important;
  }
  .blurb {
    margin: 0.2rem 0 0.5rem !important;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .head,
  li {
    display: grid;
    grid-template-columns: 2.6rem minmax(0, 1fr) 3.4rem 3.4rem;
    column-gap: 0.5rem;
    align-items: baseline;
  }
  .head {
    padding: 0 0 0.2rem;
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--mute);
  }
  .head span:nth-child(n + 3) {
    text-align: right;
  }
  .head span.hch {
    display: none;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    margin: 0;
    padding: 0.4rem 0;
    border-top: 1px solid var(--line);
    font-size: 0.86rem;
  }
  li.got .name {
    color: var(--ok);
  }
  input[type='checkbox'] {
    width: 1.1rem;
    height: 1.1rem;
    margin: 0 0 0 0.35rem;
    accent-color: var(--copper);
    align-self: center;
  }
  label {
    cursor: pointer;
    display: grid;
    gap: 0.05rem;
  }
  .name {
    font-weight: 600;
    color: var(--fg);
  }
  .detail {
    font-size: 0.76rem;
    color: var(--mute);
  }
  .q {
    text-align: right;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--fg);
  }
  .q.min {
    color: var(--ink-2);
  }
  .uses {
    grid-column: 2 / -1;
    margin-top: 0.15rem;
    font-size: 0.76rem;
    color: var(--mute);
  }
  .lbl {
    margin-right: 0.15rem;
    font-size: 0.66rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .uses a {
    color: var(--copper-ink);
    text-underline-offset: 2px;
  }
  .uses a:hover,
  .uses a:focus-visible {
    color: var(--fg);
  }
  @media (min-width: 720px) {
    .head,
    li {
      grid-template-columns: 2.6rem minmax(13rem, 1.2fr) minmax(0, 1fr) 4rem 4rem;
    }
    .head span.hch {
      display: block;
      text-align: left;
    }
    .uses {
      grid-column: 3;
      grid-row: 1;
      margin: 0;
    }
    .q {
      grid-row: 1;
    }
    .q:not(.min) {
      grid-column: 4;
    }
    .q.min {
      grid-column: 5;
    }
    .lbl {
      display: none;
    }
    li {
      padding: 0.3rem 0;
    }
  }
  input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
