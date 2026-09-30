/**
 * "What I already have": the ticks of the bill of materials, shared by the bill and by the list of labs, which shows
 * which labs the ticked parts are enough for. The ticks live in this browser only (localStorage), and nothing depends
 * on them: with storage blocked the page works, it just forgets.
 */
import { SvelteSet } from 'svelte/reactivity';
import { needsOf, rowOf } from './bom';
import type { Lab } from './labs';

const KEY = 'digital-circuits:appendix-d:kit';

/** The ids of the rows the reader has ticked. */
export const owned = new SvelteSet<string>();

let loaded = false;

/** Read the saved ticks (browser only; call from `onMount`). */
export function loadKit(): void {
  if (loaded) return;
  loaded = true;
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (Array.isArray(saved)) for (const id of saved) if (typeof id === 'string') owned.add(id);
  } catch {
    /* no storage, or a corrupt entry: start empty */
  }
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...owned]));
  } catch {
    /* storage blocked or full */
  }
}

export function setOwned(ids: string[], on: boolean): void {
  for (const id of ids) {
    if (on) owned.add(id);
    else owned.delete(id);
  }
  save();
}

export const toggleOwned = (id: string): void => setOwned([id], !owned.has(id));

/** The rows of a lab that are not ticked (software is free, so it never counts as missing). */
export function missingFor(lab: Lab, have: ReadonlySet<string>): string[] {
  return [...needsOf(lab).keys()].filter((id) => !rowOf(id).software && !have.has(id)).map((id) => rowOf(id).name);
}
