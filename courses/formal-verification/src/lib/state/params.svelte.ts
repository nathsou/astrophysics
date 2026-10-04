/**
 * Shared, page-wide reactive state that links equations and widgets.
 *
 * - `params` holds live numeric parameters (e.g. "zipf.s"). A term in an equation can bind a
 *   slider to a key; any widget reading the same key updates in lock-step.
 * - `focus` records which equation term (or tensor/element) is currently hovered, so a widget
 *   can highlight the corresponding part of its visualisation — and vice versa.
 */

class Params {
  values: Record<string, number> = $state({});

  get(key: string, fallback: number): number {
    return this.values[key] ?? fallback;
  }

  set(key: string, value: number): void {
    this.values[key] = value;
  }

  /** Set the value only if no one has initialised it yet. */
  init(key: string, value: number): void {
    if (!(key in this.values)) this.values[key] = value;
  }
}

export const params = new Params();

class Focus {
  /** Id of the hovered/pinned equation term, or null. */
  term: string | null = $state(null);
  /** Where the focus came from — lets a widget avoid reacting to its own hover. */
  source: string | null = $state(null);

  set(term: string | null, source: string | null = null): void {
    this.term = term;
    this.source = source;
  }
}

export const focus = new Focus();
