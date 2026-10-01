<script lang="ts">
  import { base } from '$app/paths';
  import '../app.css';
  import '../../../../../packages/course-navigation/navigation.css';
  import { mountSidebar, closeSidebar } from '../../../../../packages/course-navigation/sidebar';
  import { onMount, type Snippet } from 'svelte';
  import { theme } from '$lib/state/theme.svelte';
  import { nav } from '$lib/state/nav.svelte';
  import TopBar from '$lib/components/layout/TopBar.svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import { afterNavigate } from '$app/navigation';

  let { children }: { children: Snippet } = $props();

  onMount(() => {
    theme.init();
    return mountSidebar('language-models', state => (nav.sidebarOpen = state.open));
  });
  afterNavigate(closeSidebar);
</script>

<a class="skip ui" href="#main">Skip to content</a>
<nav class="course-index-nav" aria-label="Course collection">
  <a class="course-index-link" href="{base}/../" data-sveltekit-reload><span aria-hidden="true">←</span> All courses</a>
  <button class="course-sidebar-toggle" type="button" aria-controls="course-contents" aria-expanded="true" data-sidebar-toggle>
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
    <span data-sidebar-label>Hide contents</span>
  </button>
</nav>
<TopBar />
<div class="shell course-shell">
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
    min-height: calc(100vh - 3.25rem - var(--course-nav-height));
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
