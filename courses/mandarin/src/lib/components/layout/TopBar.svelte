<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { COURSE_TITLE } from '$content/outline';
  import { theme } from '$lib/state/theme.svelte';
  import { nav } from '$lib/state/nav.svelte';
  import { deck } from '$lib/srs/deck.svelte';
  import Icon from '../ui/Icon.svelte';
  import ScaffoldDial from './ScaffoldDial.svelte';

  let scrolled = $state(false);
  const path = $derived(page.url.pathname.slice(base.length));
  const due = $derived.by(() => {
    const c = deck.counts();
    return c.due + c.fresh;
  });
  const links = [
    { href: '/review/', label: 'Review', icon: 'cards', title: 'Spaced-repetition review of your words' },
    { href: '/practice/', label: 'Practice', icon: 'game', title: 'Games and drills' },
    { href: '/words/', label: 'Words', icon: 'book', title: 'Every HSK 1–2 word' },
    { href: '/exam/', label: 'Mock exam', icon: 'exam', title: 'HSK-style mock tests' },
  ];
</script>

<svelte:window onscroll={() => (scrolled = scrollY > 160)} />

<header class="topbar ui" class:scrolled>
  <button class="course-sidebar-toggle" type="button" aria-controls="course-contents" aria-expanded="true" aria-label="Hide contents" title="Hide contents" data-sidebar-toggle>
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
  </button>
  <a class="brand" href="{base}/">
    <span class="seal zh-font" aria-hidden="true">声</span>
    <span class="name">{COURSE_TITLE}</span>
  </a>
  <span class="page-title" aria-hidden={!scrolled}>{nav.pageTitle ?? ''}</span>
  <span class="spacer"></span>
  <nav class="links" aria-label="Tools">
    {#each links as l (l.href)}
      <a href="{base}{l.href}" class:current={path.startsWith(l.href)} aria-current={path.startsWith(l.href) ? 'page' : undefined} title={l.title} aria-label={l.label}>
        <Icon name={l.icon} size={17} /><span class="lbl">{l.label}</span>
        {#if l.href === '/review/' && due > 0}<span class="badge" aria-label="{due} cards to review">{due}</span>{/if}
      </a>
    {/each}
  </nav>
  <ScaffoldDial />
  <a class="icon-btn" href="{base}/settings/" class:current={path.startsWith('/settings/')} aria-label="Settings" title="Settings"><Icon name="settings" /></a>
  <button class="icon-btn" onclick={() => theme.set(theme.resolved === 'dark' ? 'light' : 'dark')} aria-label="Switch to {theme.resolved === 'dark' ? 'light' : 'dark'} theme" title="Switch to {theme.resolved === 'dark' ? 'light' : 'dark'} theme">
    <Icon name={theme.resolved === 'dark' ? 'sun' : 'moon'} />
  </button>
</header>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 40;
    height: 3.5rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0 max(1rem, env(safe-area-inset-left));
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(10px) saturate(1.2);
    -webkit-backdrop-filter: blur(10px) saturate(1.2);
    border-bottom: 1px solid var(--line);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    color: var(--fg);
    text-decoration: none;
    font-family: var(--font-body);
    font-weight: 650;
    font-size: 1.05rem;
    white-space: nowrap;
  }
  .seal {
    display: grid;
    place-items: center;
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 7px;
    background: var(--accent);
    color: #fff;
    font-size: 1.2rem;
    line-height: 1;
    transform: rotate(-4deg);
  }
  .page-title {
    font-size: 0.88rem;
    color: var(--ink-2);
    opacity: 0;
    transition: opacity 180ms;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .page-title::before {
    content: '/';
    margin-right: 0.6rem;
    color: var(--line-strong);
  }
  .scrolled .page-title {
    opacity: 1;
  }
  .spacer {
    flex: 1;
  }
  .links {
    display: flex;
    gap: 0.15rem;
  }
  .links a,
  .icon-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    height: 2.25rem;
    padding: 0 0.6rem;
    border-radius: 8px;
    color: var(--ink-2);
    text-decoration: none;
    font-size: 0.86rem;
    font-weight: 550;
    border: 1px solid transparent;
    background: none;
    cursor: pointer;
  }
  .icon-btn {
    padding: 0;
    width: 2.25rem;
    justify-content: center;
  }
  .links a:hover,
  .icon-btn:hover {
    background: var(--panel);
    border-color: var(--line);
    color: var(--fg);
  }
  .links a.current,
  .icon-btn.current {
    color: var(--accent-ink);
    background: var(--panel);
    border-color: var(--line);
  }
  .badge {
    min-width: 1.15rem;
    height: 1.15rem;
    padding: 0 0.3rem;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
    font-size: 0.68rem;
    font-weight: 700;
    display: grid;
    place-items: center;
  }
  @media (max-width: 1180px) {
    .lbl {
      display: none;
    }
    .page-title {
      display: none;
    }
  }
  @media (max-width: 560px) {
    .topbar {
      gap: 0.2rem;
      padding: 0 0.5rem;
    }
    .brand .name {
      display: none;
    }
    .links a {
      padding: 0 0.45rem;
    }
    .badge {
      position: absolute;
      top: 0;
      right: -2px;
    }
  }
  @media (max-width: 360px) {
    .topbar { gap: 0.1rem; padding: 0 0.25rem; }
    .links { gap: 0; }
    .links a { padding: 0 0.2rem; }
    .icon-btn { width: 1.7rem; flex: none; }
    .seal { width: 1.6rem; height: 1.6rem; }
    .brand { gap: 0; }
    .spacer { display: none; }
  }
</style>
