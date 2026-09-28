<script lang="ts">
  import { base } from '$app/paths';
  import { COURSE_TITLE } from '$content/outline';
  import { theme } from '$lib/state/theme.svelte';
  import { nav } from '$lib/state/nav.svelte';
  import Icon from '../ui/Icon.svelte';
  import GpuBadge from './GpuBadge.svelte';

  let scrolled = $state(false);
</script>

<svelte:window onscroll={() => (scrolled = scrollY > 160)} />

<header class="topbar ui" class:scrolled>
  <button class="icon-btn menu" onclick={() => (nav.sidebarOpen = !nav.sidebarOpen)} aria-label="Open navigation" aria-expanded={nav.sidebarOpen}>
    <Icon name="menu" />
  </button>
  <a class="brand" href="{base}/">
    <span class="mark" aria-hidden="true">LM</span>
    <span class="name">{COURSE_TITLE}</span>
  </a>
  <span class="page-title" aria-hidden={!scrolled}>{nav.pageTitle ?? ''}</span>
  <span class="spacer"></span>
  <GpuBadge />
  <button class="icon-btn" onclick={() => theme.set(theme.resolved === 'dark' ? 'light' : 'dark')} aria-label="Switch to {theme.resolved === 'dark' ? 'light' : 'dark'} theme">
    <Icon name={theme.resolved === 'dark' ? 'sun' : 'moon'} />
  </button>
</header>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 40;
    height: 3.25rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0 1rem;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: saturate(1.4) blur(10px);
    -webkit-backdrop-filter: saturate(1.4) blur(10px);
    border-bottom: 1px solid var(--rule);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    color: var(--ink);
    text-decoration: none;
    font-weight: 700;
    font-size: 0.95rem;
    letter-spacing: -0.02em;
  }
  .mark {
    display: grid;
    place-items: center;
    height: 1.6rem;
    padding: 0 0.5rem 0 0.45rem;
    border-left: 3px solid var(--ac);
    border-radius: 0 var(--radius) var(--radius) 0;
    background: var(--pn);
    color: var(--accent);
    font: 500 0.7rem var(--font-mono);
    letter-spacing: 0.02em;
  }
  .page-title {
    font: 400 0.78rem var(--font-mono);
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
    color: var(--ink-3);
  }
  .scrolled .page-title {
    opacity: 1;
    transform: none;
  }
  .spacer {
    flex: 1;
  }
  .icon-btn {
    display: inline-flex;
    border: 0;
    background: none;
    padding: 0.4rem;
    border-radius: var(--radius);
    color: var(--ink-2);
    cursor: pointer;
  }
  .icon-btn:hover {
    background: var(--pn);
    color: var(--ink);
  }
  .menu {
    display: none;
  }
  @media (max-width: 1099px) {
    .menu {
      display: inline-flex;
    }
  }
  @media (max-width: 640px) {
    .name,
    .page-title {
      display: none;
    }
  }
</style>
