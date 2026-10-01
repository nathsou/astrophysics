export interface SidebarState {
  open: boolean;
  collapsed: boolean;
  mobile: boolean;
}

/** Close an open drawer when a course navigates without reloading its layout. */
export function closeSidebar(): void {
  window.dispatchEvent(new Event('course-sidebar-close'));
}

/** Shared disclosure behavior for the Astro, React, Solid and Svelte course shells. */
export function mountSidebar(course: string, onChange?: (state: SidebarState) => void): () => void {
  const root = document.documentElement;
  const button = document.querySelector<HTMLButtonElement>('[data-sidebar-toggle]');
  const sidebar = document.getElementById('course-contents');
  const main = document.querySelector<HTMLElement>('.course-shell > main, .course-shell > .main');
  if (!button || !sidebar) return () => {};

  const label = button.querySelector('[data-sidebar-label]');
  const key = `${course}:sidebar`;
  const media = matchMedia('(max-width: 1099px)');
  const originalSidebarInert = sidebar.inert;
  const originalMainInert = main?.inert ?? false;
  const originalOverflow = document.body.style.overflow;
  let collapsed = root.dataset.sidebar === 'collapsed';
  let mobileOpen = false;
  try { collapsed = localStorage.getItem(key) === 'collapsed'; } catch { /* Keep the in-memory choice when storage is unavailable. */ }

  const scrim = document.createElement('button');
  scrim.type = 'button';
  scrim.className = 'course-sidebar-scrim';
  scrim.setAttribute('aria-label', 'Close course contents');
  scrim.tabIndex = -1;
  document.body.append(scrim);

  const update = () => {
    const mobile = media.matches;
    const open = mobile ? mobileOpen : !collapsed;
    if (collapsed) root.dataset.sidebar = 'collapsed';
    else delete root.dataset.sidebar;
    if (mobile && mobileOpen) root.dataset.sidebarOpen = 'true';
    else delete root.dataset.sidebarOpen;
    button.setAttribute('aria-expanded', String(open));
    const text = mobile ? 'Contents' : open ? 'Hide contents' : 'Show contents';
    if (label) label.textContent = text;
    button.setAttribute('aria-label', mobile ? open ? 'Hide contents' : 'Show contents' : text);
    sidebar.inert = !open;
    if (main) main.inert = originalMainInert || (mobile && mobileOpen);
    document.body.style.overflow = mobile && mobileOpen ? 'hidden' : originalOverflow;
    onChange?.({ open, collapsed, mobile });
  };

  const close = () => {
    mobileOpen = false;
    update();
  };
  const revealCurrent = () => {
    const link = sidebar.querySelector<HTMLElement>('a[aria-current="page"], a.active, .here > a');
    if (!link) return;
    const r = link.getBoundingClientRect(), s = sidebar.getBoundingClientRect();
    if (r.top < s.top || r.bottom > s.bottom) sidebar.scrollTop += r.top - s.top - s.height / 3;
  };
  const toggle = () => {
    if (media.matches) mobileOpen = !mobileOpen;
    else {
      collapsed = !collapsed;
      try {
        if (collapsed) localStorage.setItem(key, 'collapsed');
        else localStorage.removeItem(key);
      } catch { /* The current view remains usable without storage. */ }
    }
    update();
    if (media.matches && mobileOpen) revealCurrent();
  };
  const dismiss = () => {
    close();
    button.focus();
  };
  const onClick = (event: MouseEvent) => {
    if (media.matches && mobileOpen && event.target instanceof Element && event.target.closest('#course-contents a, #course-contents button')) close();
  };
  const onKey = (event: KeyboardEvent) => {
    if (!media.matches || !mobileOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
    } else if (event.key === 'Tab') {
      // Keep keyboard navigation within the disclosure and its contents while the drawer is open.
      const links = [...document.querySelectorAll<HTMLElement>('.course-index-nav a, .course-index-nav button, #course-contents a[href], #course-contents button, #course-contents summary, #course-contents input')]
        .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.checkVisibility({ visibilityProperty: true }));
      const first = links[0], last = links.at(-1);
      if (event.shiftKey && document.activeElement === first && last) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last && first) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key && event.key !== null) return;
    try { collapsed = localStorage.getItem(key) === 'collapsed'; } catch { return; }
    update();
  };

  button.addEventListener('click', toggle);
  scrim.addEventListener('click', dismiss);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  media.addEventListener('change', close);
  window.addEventListener('hashchange', close);
  window.addEventListener('popstate', close);
  window.addEventListener('course-sidebar-close', close);
  window.addEventListener('storage', onStorage);
  update();

  return () => {
    button.removeEventListener('click', toggle);
    scrim.remove();
    document.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
    media.removeEventListener('change', close);
    window.removeEventListener('hashchange', close);
    window.removeEventListener('popstate', close);
    window.removeEventListener('course-sidebar-close', close);
    window.removeEventListener('storage', onStorage);
    delete root.dataset.sidebarOpen;
    sidebar.inert = originalSidebarInert;
    if (main) main.inert = originalMainInert;
    document.body.style.overflow = originalOverflow;
  };
}
