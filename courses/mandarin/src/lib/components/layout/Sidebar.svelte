<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { PARTS } from '$content/outline';
  import { hasLesson } from '$lib/content/lessons';
  import { progress } from '$lib/state/progress.svelte';
  import { nav } from '$lib/state/nav.svelte';

  const current = $derived(page.url.pathname.slice(base.length));
  let n = 0;
  const numbered = PARTS.map((p) => ({ ...p, lessons: p.lessons.map((l) => ({ ...l, n: ++n })) }));
</script>

<nav id="course-contents" class="sidebar ui" class:open={nav.sidebarOpen} aria-label="Course contents">
  <div class="course-sidebar-tools">
    <a class="course-index-link" href="{base}/../" data-sveltekit-reload><span aria-hidden="true">←</span> All courses</a>
    <button class="course-sidebar-toggle" type="button" aria-controls="course-contents" aria-expanded="true" aria-label="Hide contents" title="Hide contents" data-sidebar-toggle>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
    </button>
  </div>
  <a class="home" class:here={current === '/'} href="{base}/">Course map</a>
  {#each numbered as part (part.id)}
    <section>
      <h2><span class="pzh zh-font">{part.zh}</span> {part.title}</h2>
      <ol>
        {#each part.lessons as l (l.slug)}
          {@const href = `/learn/${l.slug}/`}
          {@const here = current === href}
          {@const done = !!progress.data.completed[l.slug]}
          <li class:here class:done>
            {#if hasLesson(l.slug)}
              <a href="{base}{href}" aria-current={here ? 'page' : undefined}>
                <span class="n">{done ? '✓' : l.n}</span><span class="t">{l.title}</span>
              </a>
            {:else}
              <span class="soon"><span class="n">{l.n}</span><span class="t">{l.title}</span></span>
            {/if}
            {#if here && nav.toc.length}
              <ul class="toc">
                {#each nav.toc as t (t.id)}
                  <li class:active={nav.activeId === t.id}><a href="#{t.id}">{t.text}</a></li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ol>
    </section>
  {/each}
</nav>

<style>
  .sidebar {
    position: sticky;
    top: 3.5rem;
    height: calc(100dvh - 3.5rem);
    overflow-y: auto;
    padding: 1.2rem 0.8rem 3rem 1rem;
    border-right: 1px solid var(--line);
    font-size: 0.87rem;
    scrollbar-width: thin;
  }
  .home {
    display: block;
    padding: 0.35rem 0.5rem;
    border-radius: 8px;
    color: var(--fg);
    font-weight: 600;
    text-decoration: none;
    margin-bottom: 0.6rem;
  }
  .home:hover,
  .home.here {
    background: var(--pn);
  }
  section + section {
    margin-top: 1.1rem;
  }
  h2 {
    font-family: var(--font-ui);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--mute);
    margin: 0 0 0.3rem 0.5rem;
  }
  .pzh {
    color: var(--accent-ink);
    font-size: 0.85rem;
    letter-spacing: 0;
    margin-right: 0.15rem;
  }
  ol,
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  ol > li > a,
  .soon {
    display: grid;
    grid-template-columns: 1.7rem 1fr;
    align-items: baseline;
    padding: 0.3rem 0.5rem 0.3rem 0.3rem;
    border-radius: 8px;
    color: var(--fg);
    text-decoration: none;
    line-height: 1.35;
  }
  ol > li > a:hover {
    background: var(--pn);
  }
  .n {
    font-variant-numeric: tabular-nums;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--mute);
    text-align: center;
  }
  .done .n {
    color: var(--jade);
  }
  .here > a {
    background: var(--pn);
    font-weight: 650;
  }
  .here .n {
    color: var(--accent-ink);
  }
  .soon {
    color: var(--mute);
    cursor: default;
  }
  .toc {
    margin: 0.15rem 0 0.4rem 1.9rem;
    border-left: 1px solid var(--line);
  }
  .toc a {
    display: block;
    padding: 0.18rem 0.6rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    text-decoration: none;
    margin-left: -1px;
    border-left: 2px solid transparent;
  }
  .toc .active a {
    color: var(--fg);
    border-left-color: var(--accent);
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
