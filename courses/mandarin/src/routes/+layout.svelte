<script lang="ts">
  import '../app.css';
  import '../../../../packages/course-navigation/navigation.css';
  import { mountSidebar, closeSidebar } from '../../../../packages/course-navigation/sidebar';
  import { onMount, type Snippet } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { theme } from '$lib/state/theme.svelte';
  import { nav } from '$lib/state/nav.svelte';
  import { settings } from '$lib/state/settings.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { deck } from '$lib/srs/deck.svelte';
  import { speech } from '$lib/audio/speech.svelte';
  import { COURSE_SUBTITLE, COURSE_TITLE } from '$content/outline';
  import TopBar from '$lib/components/layout/TopBar.svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import WordCard from '$lib/components/zh/WordCard.svelte';
  import { popover } from '$lib/components/zh/popover.svelte';
  import TeacherChat from '$lib/components/layout/TeacherChat.svelte';

  let { children }: { children: Snippet } = $props();

  onMount(() => {
    theme.init();
    settings.load();
    progress.load();
    deck.load();
    speech.prepare();
    return mountSidebar('mandarin', (state) => (nav.sidebarOpen = state.open));
  });
  afterNavigate(() => {
    closeSidebar();
    popover.close();
    speech.stop();
  });
</script>

<a class="skip ui" href="#main">Skip to content</a>
<TopBar />
<div class="shell course-shell">
  <Sidebar />
  <main id="main">
    {@render children()}
  </main>
</div>
<WordCard />
<TeacherChat />
<footer class="foot ui">
  <p class="t"><span class="zh-font">声</span> {COURSE_TITLE}</p>
  <p class="s">{COURSE_SUBTITLE}. Progress is saved in this browser only.</p>
</footer>

<style>
  .skip {
    position: absolute;
    left: -999px;
    top: 0.5rem;
    z-index: 100;
    background: var(--fg);
    color: var(--bg);
    font-weight: 600;
    border-radius: 6px;
    padding: 0.45rem 0.9rem;
    text-decoration: none;
  }
  .skip:focus {
    left: 0.5rem;
  }
  .shell {
    display: grid;
    grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
    min-height: calc(100vh - 3.5rem);
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
    border-top: 1px solid var(--line);
    padding: 1.5rem max(1rem, calc((100% - 72rem) / 2 + 1rem)) 2rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    align-items: baseline;
  }
  .foot p {
    margin: 0;
  }
  .t {
    font-weight: 650;
    font-size: 0.92rem;
  }
  .s {
    font-size: 0.78rem;
    color: var(--mute);
  }
</style>
