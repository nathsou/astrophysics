<script lang="ts">
  import '../app.css';
  import { onMount, type Snippet } from 'svelte';
  import { theme } from '$lib/state/theme.svelte';
  import { nav } from '$lib/state/nav.svelte';
  import TopBar from '$lib/components/layout/TopBar.svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import { afterNavigate } from '$app/navigation';

  let { children }: { children: Snippet } = $props();

  onMount(() => theme.init());
  afterNavigate(() => (nav.sidebarOpen = false));
</script>

<a class="skip ui" href="#main">Skip to content</a>
<TopBar />
<div class="shell">
  <Sidebar />
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
    background: var(--surface);
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
  }
  .skip:focus {
    left: 0.5rem;
  }
  .shell {
    display: grid;
    grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
    min-height: calc(100vh - 3.25rem);
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
