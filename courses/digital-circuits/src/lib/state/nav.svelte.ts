import type { TocEntry } from '$lib/content/types';

/** UI state shared between the page and the shell (sidebar, top bar). */
class Nav {
  sidebarOpen = $state(false);
  /** Table of contents of the current page, for the sidebar. */
  toc: TocEntry[] = $state([]);
  /** Id of the section currently in view. */
  activeId: string | null = $state(null);
  /** Title of the current page, shown in the top bar once scrolled. */
  pageTitle: string | null = $state(null);
}

export const nav = new Nav();
