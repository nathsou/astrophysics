import { createContext } from 'svelte';

/** Shared by a stepper container (proof zoom, hint ladder) and its items. */
export interface StepperCtx {
  /** Claim the next index (items call this once, in document order). */
  claim(): number;
  /** Index of the visible level (zoom) or the number of revealed items (hints). */
  readonly current: number;
}

export const [getZoom, setZoom] = createContext<StepperCtx>();
export const [getHints, setHints] = createContext<StepperCtx>();
