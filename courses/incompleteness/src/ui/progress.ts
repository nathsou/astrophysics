// Where the reader left off: the last section they opened, for "Continue" on the title page.

import { persist, persisted } from './store';

const KEY = 'ic.last';

export function recordVisit(sectionId: string) {
  persist(KEY, sectionId);
}

/** The last section opened, if it is still a section of the book (`known`). */
export function lastVisited(known: (id: string) => boolean): string | null {
  const id = persisted<unknown>(KEY, null);
  return typeof id === 'string' && known(id) ? id : null;
}
