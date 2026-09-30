import type { TocEntry } from '$lib/content/types';

/** UI state shared between the page and the shell (sidebar, top bar). */
class Nav {
  sidebarOpen = $state(false);
  /** Wide screens: the reader has folded the sidebar away. Remembered between visits. */
  sidebarCollapsed = $state(false);
  /** Table of contents of the current page, for the sidebar. */
  toc: TocEntry[] = $state([]);
  /** Id of the section currently in view. */
  activeId: string | null = $state(null);
  /** Title of the current page, shown in the top bar once scrolled. */
  pageTitle: string | null = $state(null);

  /** Pick up the state that app.html applied before first paint. */
  init(): void {
    this.sidebarCollapsed = document.documentElement.dataset.sidebar === 'collapsed';
  }

  toggleCollapsed(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    if (this.sidebarCollapsed) document.documentElement.dataset.sidebar = 'collapsed';
    else delete document.documentElement.dataset.sidebar;
    try {
      if (this.sidebarCollapsed) localStorage.setItem('particle-physics:sidebar', 'collapsed');
      else localStorage.removeItem('particle-physics:sidebar');
    } catch {
      /* storage unavailable: the choice still applies for this page view */
    }
  }
}

export const nav = new Nav();
