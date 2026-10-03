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
  <div class="course-sidebar-tools">
    <a class="course-index-link" href="{base}/../" data-sveltekit-reload><span aria-hidden="true">←</span> All courses</a>
    <button class="course-sidebar-toggle" type="button" aria-controls="course-contents" aria-expanded="true" aria-label="Hide contents" title="Hide contents" data-sidebar-toggle>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
    </button>
  </div>
  {#each PARTS as part (part.id)}
    <section>
      <h2>
        {#if part.id !== '0' && part.id !== 'E'}<span class="part">Part {part.id}</span>{/if}
        <span class="ptitle">{part.title}</span>
      </h2>
      <ul class="trace">
        {#each part.chapters as c (c.slug)}{@render item(`chapter:${c.slug}`)}{/each}
      </ul>
    </section>
  {/each}
  <section>
    <h2><span class="ptitle">Appendices</span></h2>
    <ul class="trace">
      {#each appendices as a (a.slug)}{@render item(`appendix:${a.slug}`)}{/each}
    </ul>
  </section>
</nav>

<style>
  .sidebar {
    position: sticky;
    top: 3.5rem;
    height: calc(100dvh - 3.5rem);
    overflow-y: auto;
    padding: 1.4rem 0.9rem 3rem 1rem;
    border-right: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg) 70%, transparent);
    font-size: 0.88rem;
    scrollbar-width: thin;
    scrollbar-color: var(--line-strong) transparent;
  }
  section + section {
    margin-top: 1.35rem;
  }
  h2 {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    margin: 0 0 0.35rem 0;
    padding-left: 0.2rem;
    line-height: 1.3;
  }
  .part {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 600;
    color: var(--copper-ink);
  }
  .ptitle {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--fg);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  /* The part's chapters sit on a copper trace; each chapter is a pad on it. */
  .trace {
    position: relative;
  }
  .trace::before {
    content: '';
    position: absolute;
    left: calc(1.45rem / 2 - 0.75px);
    top: 0.6rem;
    bottom: 0.6rem;
    width: 1.5px;
    background: color-mix(in srgb, var(--copper) 45%, var(--line));
  }
  li {
    position: relative;
  }
  .trace > li > a,
  .row {
    position: relative;
    display: grid;
    grid-template-columns: 1.45rem 1.6rem 1fr;
    align-items: baseline;
    padding: 0.28rem 0.5rem 0.28rem 0;
    border-radius: 6px;
    color: var(--fg);
    text-decoration: none;
    line-height: 1.35;
  }
  .trace > li > a::before,
  .row::before {
    content: '';
    grid-column: 1;
    justify-self: center;
    align-self: center;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1.5px solid var(--copper);
    background: var(--bg);
    box-sizing: border-box;
    position: relative;
  }
  .trace > li > a:hover {
    background: color-mix(in srgb, var(--pn) 80%, transparent);
  }
  .trace > li > a:hover::before {
    background: var(--copper);
  }
  .n {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--copper-ink);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  /* You are here: the pad is driven HIGH. */
  .here > a {
    background: var(--pn);
    font-weight: 600;
  }
  .here > a::before {
    background: var(--sig-high);
    border-color: var(--sig-high);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--sig-high) 22%, transparent), 0 0 8px var(--sig-high-glow);
  }
  /* Planned chapters are floating (Z): a dashed grey pad. */
  .planned .row {
    color: var(--mute);
    cursor: default;
  }
  .planned .row::before {
    border: 1.5px dashed var(--sig-z);
  }
  .planned .n {
    color: var(--mute);
  }
  .toc {
    margin: 0.15rem 0 0.4rem 2.1rem;
    border-left: 1px solid var(--line);
  }
  .toc a {
    display: block;
    padding: 0.2rem 0.6rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin-left: -1px;
    border-left: 2px solid transparent;
    text-decoration: none;
  }
  .toc a:hover {
    color: var(--fg);
  }
  .toc .active a {
    color: var(--fg);
    border-left-color: var(--sig-high);
    font-weight: 600;
  }
  @media (max-width: 1099px) {
    .sidebar {
      position: fixed;
      top: 3.5rem;
      left: 0;
      z-index: 45;
      width: min(20rem, 88vw);
      background: var(--bg);
      transform: translateX(-100%);
      visibility: hidden;
      transition: transform 200ms ease, visibility 200ms;
    }
    .sidebar.open {
      transform: none;
      visibility: visible;
      box-shadow: var(--shadow-lg);
    }
  }
</style>
