/** Page-level navigation state shared by the shell. */
class Nav {
  sidebarOpen = $state(false);
  pageTitle: string | null = $state(null);
  toc: { id: string; text: string }[] = $state([]);
  activeId: string | null = $state(null);
}
export const nav = new Nav();
