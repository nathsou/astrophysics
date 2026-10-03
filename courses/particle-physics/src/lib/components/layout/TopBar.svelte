<script lang="ts">
  import { base } from '$app/paths';
  import { COURSE_TITLE } from '$content/outline';
  import { theme } from '$lib/state/theme.svelte';
  import { nav } from '$lib/state/nav.svelte';
  import { page } from '$app/state';
  import Icon from '../ui/Icon.svelte';

  let scrolled = $state(false);
  const onControl = $derived(page.url.pathname.startsWith(`${base}/control-room`));
  const onUnits = $derived(page.url.pathname.startsWith(`${base}/units`));
</script>

<svelte:window onscroll={() => (scrolled = scrollY > 160)} />

<header class="topbar ui" class:scrolled>
  <button class="course-sidebar-toggle" type="button" aria-controls="course-contents" aria-expanded="true" aria-label="Hide contents" title="Hide contents" data-sidebar-toggle>
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
  </button>
  <a class="brand" href="{base}/">
    <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" class="tile" />
      <path d="M6 26C8 14 14 8 26 6" class="base" />
      <path d="M6 26c4-1 9-5 11-10 1.5-3.6 1.5-6.6 0-9" class="wave" />
    </svg>
    <span class="name">{COURSE_TITLE}</span>
  </a>
  <span class="page-title" aria-hidden={!scrolled}>{nav.pageTitle ?? ''}</span>
  <span class="spacer"></span>
  <a class="icon-btn" class:current={onControl} href="{base}/control-room/" aria-label="The Control Room" aria-current={onControl ? 'page' : undefined} title="The Control Room: run the whole pipeline">
    <Icon name="control" />
  </a>
  <a class="icon-btn" class:current={onUnits} href="{base}/units/" aria-label="Units and constants" aria-current={onUnits ? 'page' : undefined} title="Units and constants: the natural-units converter">
    <Icon name="units" />
  </a>
  {#if theme.resolved === 'light'}
    <button
      class="icon-btn"
      class:current={theme.paper === 'white'}
      onclick={() => theme.setPaper(theme.paper === 'white' ? 'default' : 'white')}
      aria-pressed={theme.paper === 'white'}
      aria-label="White page background"
      title={theme.paper === 'white' ? 'Back to the warm paper background' : 'Use a plain white page background'}
    >
      <Icon name="page" />
    </button>
  {/if}
  <button class="icon-btn" onclick={() => theme.set(theme.resolved === 'dark' ? 'light' : 'dark')} aria-label="Switch to {theme.resolved === 'dark' ? 'light' : 'dark'} theme" title="Switch to {theme.resolved === 'dark' ? 'light' : 'dark'} theme">
    <Icon name={theme.resolved === 'dark' ? 'sun' : 'moon'} />
  </button>
</header>

<style>
  .topbar {
    position: sticky;
    top: 0px;
    z-index: 40;
    height: 3.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0 max(1rem, env(safe-area-inset-left));
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(10px) saturate(1.2);
    -webkit-backdrop-filter: blur(10px) saturate(1.2);
    border-bottom: 1px solid var(--line);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--fg);
    text-decoration: none;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 1.05rem;
    letter-spacing: -0.015em;
    white-space: nowrap;
  }
  .brand:hover .name {
    color: var(--track-ink);
  }
  .mark {
    width: 1.75rem;
    height: 1.75rem;
    flex: none;
  }
  .tile {
    fill: light-dark(#1c2127, #1a2433);
  }
  .base {
    stroke: light-dark(#4b5563, #35465d);
    stroke-width: 1.2;
  }
  .wave {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 2.6;
    stroke-linejoin: round;
    stroke-linecap: round;
    filter: drop-shadow(0 0 1.5px rgb(255 178 62 / 0.6));
  }
  .page-title {
    font-size: 0.88rem;
    font-weight: 500;
    color: var(--ink-2);
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 180ms, transform 180ms;
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
    transform: none;
  }
  .spacer {
    flex: 1;
  }
  .icon-btn {
    display: inline-grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid transparent;
    background: none;
    border-radius: 8px;
    color: var(--ink-2);
    cursor: pointer;
    transition: background-color 120ms, border-color 120ms, color 120ms;
  }
  .icon-btn:hover {
    border-color: var(--line);
    background: var(--panel);
    color: var(--fg);
  }
  a.icon-btn {
    text-decoration: none;
  }
  .icon-btn.current {
    color: var(--track-ink);
    border-color: var(--line);
    background: var(--panel);
  }
  @media (max-width: 420px) {
    .topbar {
      gap: 0.35rem;
      padding: 0 0.6rem;
    }
    .brand .name {
      display: none;
    }
  }
  @media (max-width: 640px) {
    .page-title {
      display: none;
    }
  }
</style>
