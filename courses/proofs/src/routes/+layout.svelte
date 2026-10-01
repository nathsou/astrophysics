<script lang="ts">
  import '../app.css';
  import '../../../../packages/course-navigation/navigation.css';
  import { mountSidebar, closeSidebar } from '../../../../packages/course-navigation/sidebar';
  import { onMount, type Snippet } from 'svelte';
  import { theme } from '$lib/state/theme.svelte';
  import { nav } from '$lib/state/nav.svelte';
  import { COURSE_SUBTITLE, COURSE_TITLE } from '$content/outline';
  import TopBar from '$lib/components/layout/TopBar.svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import TutorSettings from '$lib/tutor/TutorSettings.svelte';
  import { afterNavigate } from '$app/navigation';
  import { base } from '$app/paths';

  let { children }: { children: Snippet } = $props();

  onMount(() => {
    theme.init();
    return mountSidebar('proofs', state => (nav.sidebarOpen = state.open));
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
<footer class="foot ui">
  <div class="bars" aria-hidden="true"><span></span><span></span><span></span></div>
  <p>{COURSE_TITLE} · {COURSE_SUBTITLE}</p>
</footer>
<TutorSettings />

<style>
  .skip {
    position: absolute;
    left: -999px;
    top: 0.5rem;
    z-index: 100;
    background: var(--fx-yellow);
    color: var(--fx-ink);
    font-weight: 700;
    border: 2px solid var(--fx-ink);
    padding: 0.4rem 0.8rem;
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
  .foot {
    border-top: 2px solid var(--fg);
    padding: 1.5rem max(1rem, calc((100% - 72rem) / 2 + 1rem)) 2rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.9rem 1.5rem;
  }
  .bars {
    display: flex;
    height: 0.8rem;
    width: 5rem;
    flex: none;
  }
  .bars span {
    flex: 1;
  }
  .bars span:nth-child(1) {
    background: var(--fx-red);
  }
  .bars span:nth-child(2) {
    background: var(--fx-yellow);
  }
  .bars span:nth-child(3) {
    background: var(--fx-blue);
  }
  .foot p {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--mute);
  }
</style>
