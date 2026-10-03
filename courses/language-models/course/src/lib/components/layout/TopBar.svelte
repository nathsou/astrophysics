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
  <button class="course-sidebar-toggle" type="button" aria-controls="course-contents" aria-expanded="true" aria-label="Hide contents" title="Hide contents" data-sidebar-toggle>
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
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
    top: 0px;
    z-index: 40;
    height: 3.25rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0 1rem;
    background: color-mix(in srgb, var(--page) 85%, transparent);
    /* Prefixed first: Lightning CSS (Vite's minifier) drops an unprefixed declaration that is followed by its
       prefixed twin, which left Chrome and Firefox with no blur at all. */
    -webkit-backdrop-filter: saturate(1.4) blur(10px);
    backdrop-filter: saturate(1.4) blur(10px);
    border-bottom: 1px solid transparent;
    transition: border-color 150ms;
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .topbar {
      background: var(--page);
    }
  }
  .scrolled {
    border-bottom-color: var(--rule);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--ink);
    text-decoration: none;
    font-weight: 650;
    font-size: 0.92rem;
    letter-spacing: -0.01em;
  }
  .mark {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 7px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 0.72rem;
    font-weight: 750;
    letter-spacing: 0.02em;
  }
  .page-title {
    font-size: 0.86rem;
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
    border-radius: 7px;
    color: var(--ink-2);
    cursor: pointer;
  }
  .icon-btn:hover {
    background: var(--surface-2);
    color: var(--ink);
  }
  @media (max-width: 640px) {
    .name,
    .page-title {
      display: none;
    }
  }
</style>
