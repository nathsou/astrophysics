// The table of contents in the sidebar: which chapters start expanded, and keeping the current
// section in view (on load, after navigating, and when the mobile drawer opens).

/** Only the chapter holding the current section starts expanded; the others can be opened. */
export function chapterStartsOpen(sectionIds: readonly string[], current: string | undefined): boolean {
  return current !== undefined && sectionIds.includes(current);
}

export interface ScrollGeometry {
  /** the scroll container's visible box (client coordinates) and its scroll state */
  containerTop: number;
  containerHeight: number;
  scrollTop: number;
  scrollHeight: number;
  /** the item's box (client coordinates) */
  itemTop: number;
  itemHeight: number;
}

/** The scrollTop that centres the item in the container, clamped to the scrollable range. */
export function centeredScrollTop(g: ScrollGeometry): number {
  const offset = g.itemTop - g.containerTop + g.scrollTop; // the item's position in the scrolled content
  const target = offset - (g.containerHeight - g.itemHeight) / 2;
  const max = Math.max(0, g.scrollHeight - g.containerHeight);
  return Math.round(Math.min(max, Math.max(0, target)));
}

/** Whether the item is entirely inside the container's visible box, with a margin. */
export function isComfortablyVisible(g: ScrollGeometry, margin = 24): boolean {
  const top = g.itemTop - g.containerTop;
  return top >= margin && top + g.itemHeight <= g.containerHeight - margin;
}

interface Box {
  getBoundingClientRect(): { top: number; height: number };
}
export interface ScrollContainer extends Box {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  scrollTo(opts: { top: number; behavior: 'auto' | 'smooth' }): void;
}

/**
 * Scroll `container` (only it, never the page) so that `item` is centred. Unless `force`, does
 * nothing when the item is already comfortably visible — e.g. right after the reader clicked it.
 * Returns the scrollTop it moved to, or null if it did not move.
 */
export function revealInContainer(container: ScrollContainer, item: Box, { force, smooth }: { force: boolean; smooth: boolean }): number | null {
  const c = container.getBoundingClientRect();
  const i = item.getBoundingClientRect();
  const g: ScrollGeometry = {
    containerTop: c.top,
    containerHeight: container.clientHeight || c.height,
    scrollTop: container.scrollTop,
    scrollHeight: container.scrollHeight,
    itemTop: i.top,
    itemHeight: i.height,
  };
  if (!force && isComfortablyVisible(g)) return null;
  const top = centeredScrollTop(g);
  if (top === Math.round(container.scrollTop)) return null;
  container.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  return top;
}
