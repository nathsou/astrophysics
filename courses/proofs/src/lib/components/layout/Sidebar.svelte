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
      <span class="row" title="Coming soon"><span class="n">{e.number}</span><span>{e.title}</span></span>
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

<nav id="course-contents" class="sidebar ui" class:open={nav.sidebarOpen} aria-label="Course contents">
  {#each PARTS as part (part.id)}
    <section>
      <h2>{#if part.id !== '0' && part.id !== 'E'}<span class="part">Part {part.id}</span> {/if}{part.title}</h2>
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
    top: calc(3.25rem + var(--course-nav-height));
    height: calc(100dvh - 3.25rem - var(--course-nav-height));
    overflow-y: auto;
    padding: 1.25rem 0.75rem 3rem 1rem;
    border-right: 2px solid var(--fg);
    font-size: 0.88rem;
    scrollbar-width: thin;
  }
  section + section {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 2px solid var(--fg);
  }
  h2 {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.13em;
    font-weight: 500;
    line-height: 1.5;
    color: var(--mute);
    margin: 0 0 0.4rem 0.5rem;
  }
  .part {
    color: var(--accent);
    font-weight: 700;
    margin-right: 0.6em;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li a,
  .row {
    display: grid;
    grid-template-columns: 1.7rem 1fr;
    padding: 0.3rem 0.5rem;
    border-left: 4px solid transparent;
    color: var(--ink);
    text-decoration: none;
    font-weight: 500;
    line-height: 1.35;
  }
  li a:hover {
    background: var(--pn);
    opacity: 1;
  }
  .n {
    color: var(--accent);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .here > a {
    background: var(--pn);
    border-left-color: var(--fx-red);
    font-weight: 700;
  }
  .planned .row {
    color: var(--ink-3);
    cursor: default;
  }
  .planned .n {
    color: var(--ink-3);
  }
  .toc {
    margin: 0.2rem 0 0.4rem 2.2rem;
    border-left: 2px solid var(--fg);
  }
  .toc a {
    display: block;
    padding: 0.22rem 0.6rem;
    font-size: 0.82rem;
    font-weight: 400;
    color: var(--ink-2);
    margin-left: -2px;
    border-left: 4px solid transparent;
  }
  .toc .active a {
    color: var(--ink);
    border-left-color: var(--fx-yellow);
    font-weight: 700;
  }
  @media (max-width: 1099px) {
    .sidebar {
      position: fixed;
      top: calc(3.25rem + var(--course-nav-height));
      left: 0;
      z-index: 45;
      width: min(20rem, 88vw);
      background: var(--bg);
      transform: translateX(-100%);
      transition: transform 200ms ease;
    }
    .sidebar.open {
      transform: none;
      box-shadow: var(--shadow-lg);
    }
  }
</style>
