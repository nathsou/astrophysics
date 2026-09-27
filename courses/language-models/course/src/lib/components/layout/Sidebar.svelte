<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { PARTS } from '$content/outline';
  import { ALL_ENTRIES } from '$lib/content/registry';
  import { nav } from '$lib/state/nav.svelte';

  const appendices = ALL_ENTRIES.filter((e) => e.kind === 'appendix');
  const byKey = new Map(ALL_ENTRIES.map((e) => [`${e.kind}:${e.slug}`, e]));
  const current = $derived(page.url.pathname.replace(base, ''));
  const isCurrent = (href: string) => current === href || current === href.slice(0, -1);
</script>

{#snippet item(key: string)}
  {@const e = byKey.get(key)!}
  {@const here = isCurrent(e.href)}
  <li class:here class:planned={!e.available}>
    {#if e.available}
      <a href="{base}{e.href}" aria-current={here ? 'page' : undefined}><span class="n">{e.number}</span><span>{e.title}</span></a>
    {:else}
      <span class="row" title="Planned for milestone {e.milestone}"><span class="n">{e.number}</span><span>{e.title}</span></span>
    {/if}
    {#if here && nav.toc.length}
      <ul class="toc">
        {#each nav.toc.filter((t) => t.depth === 2) as t (t.id)}
          <li class:active={nav.activeId === t.id}><a href="#{t.id}">{t.text}</a></li>
        {/each}
      </ul>
    {/if}
  </li>
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="scrim" class:open={nav.sidebarOpen} onclick={() => (nav.sidebarOpen = false)}></div>
<nav class="sidebar ui" class:open={nav.sidebarOpen} aria-label="Course contents">
  {#each PARTS as part (part.id)}
    <section>
      <h2><span class="part">Part {part.id}</span> {part.title}</h2>
      <ul>
        {#each part.chapters as c (c.slug)}{@render item(`chapter:${c.slug}`)}{/each}
      </ul>
    </section>
  {/each}
  <section>
    <h2>Appendices</h2>
    <ul>
      {#each appendices as a (a.slug)}{@render item(`appendix:${a.slug}`)}{/each}
    </ul>
  </section>
</nav>

<style>
  .sidebar {
    position: sticky;
    top: 3.25rem;
    height: calc(100vh - 3.25rem);
    overflow-y: auto;
    padding: 1.25rem 0.75rem 3rem 1rem;
    border-right: 1px solid var(--rule);
    font-size: 0.84rem;
    scrollbar-width: thin;
  }
  section + section {
    margin-top: 1.25rem;
  }
  h2 {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 650;
    color: var(--ink-3);
    margin: 0 0 0.35rem 0.5rem;
  }
  .part {
    color: var(--accent);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li a,
  .row {
    display: grid;
    grid-template-columns: 1.6rem 1fr;
    padding: 0.28rem 0.5rem;
    border-radius: 6px;
    color: var(--ink);
    text-decoration: none;
    line-height: 1.35;
  }
  li a:hover {
    background: var(--surface-2);
  }
  .n {
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
  }
  .here > a {
    background: var(--accent-soft);
    color: var(--accent-ink);
    font-weight: 600;
  }
  .here > a .n {
    color: var(--accent);
  }
  .planned .row {
    color: var(--ink-3);
    cursor: default;
  }
  .toc {
    margin: 0.2rem 0 0.4rem 2.1rem;
    border-left: 1px solid var(--rule);
  }
  .toc a {
    display: block;
    padding: 0.2rem 0.6rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    border-radius: 0 6px 6px 0;
    margin-left: -1px;
    border-left: 2px solid transparent;
  }
  .toc .active a {
    color: var(--ink);
    border-left-color: var(--accent-2);
    font-weight: 560;
  }
  .scrim {
    display: none;
  }
  @media (max-width: 1099px) {
    .sidebar {
      position: fixed;
      top: 3.25rem;
      left: 0;
      z-index: 45;
      width: min(20rem, 88vw);
      background: var(--page);
      transform: translateX(-100%);
      transition: transform 200ms ease;
      box-shadow: var(--shadow-lg);
    }
    .sidebar.open {
      transform: none;
    }
    .scrim.open {
      display: block;
      position: fixed;
      inset: 3.25rem 0 0 0;
      z-index: 44;
      background: rgba(0, 0, 0, 0.25);
    }
  }
</style>
