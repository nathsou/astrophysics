<script lang="ts">
  import '../app.css';
  import { onMount, type Snippet } from 'svelte';
  import { theme } from '$lib/state/theme.svelte';
  import { nav } from '$lib/state/nav.svelte';
  import TopBar from '$lib/components/layout/TopBar.svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import { afterNavigate } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';

  let { children }: { children: Snippet } = $props();

  // The landing page is itself the table of contents, so it goes without the sidebar.
  const home = $derived(page.url.pathname.replace(/\/$/, '') === base);

  onMount(() => theme.init());
  afterNavigate(() => (nav.sidebarOpen = false));
</script>

<a class="skip ui" href="#main">Skip to content</a>
<TopBar menu={!home} />
<div class="shell" class:home>
  {#if !home}<Sidebar />{/if}
  <main id="main">
    {@render children()}
  </main>
</div>

<style>
  .skip {
    position: absolute;
    left: -999px;
    top: 0.5rem;
    z-index: 100;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--accent);
    padding: 0.4rem 0.8rem;
    border-radius: var(--radius);
  }
  .skip:focus {
    left: 0.5rem;
  }
  .shell {
    display: grid;
    grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
    min-height: calc(100vh - 3.25rem);
  }
  .shell.home {
    grid-template-columns: minmax(0, 1fr);
  }
  main {
    min-width: 0;
  }
  @media (max-width: 1099px) {
    .shell {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
