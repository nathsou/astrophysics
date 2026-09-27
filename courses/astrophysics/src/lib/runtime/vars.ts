// Page-level reactive variables: the glue between draggable numbers in prose (<Var>),
// computed outputs (<Out>), and simulations.
//
// In MDX:     a star of <Var name="mass" value={1} min={0.1} max={50} log step={0.1} /> M☉
//             lives <Out name="lifetime" /> years.
// In a chapter <script>:  compute('lifetime', ['mass'], ({ mass }) => fmt(1e10 * mass ** -2.5));
// In a sim:   vars.subscribe('mass', (m) => ...);  vars.set('mass', 2);

type Listener = (v: number) => void;

class VarStore {
  private values = new Map<string, number>();
  private listeners = new Map<string, Set<Listener>>();

  get(name: string, fallback = 0): number {
    return this.values.get(name) ?? fallback;
  }

  has(name: string) {
    return this.values.has(name);
  }

  set(name: string, v: number) {
    if (this.values.get(name) === v) return;
    this.values.set(name, v);
    this.listeners.get(name)?.forEach((l) => l(v));
  }

  /** Subscribe; fires immediately if the value exists. Returns unsubscribe. */
  subscribe(name: string, fn: Listener): () => void {
    let s = this.listeners.get(name);
    if (!s) this.listeners.set(name, (s = new Set()));
    s.add(fn);
    if (this.values.has(name)) fn(this.values.get(name)!);
    return () => s!.delete(fn);
  }
}

export const vars = new VarStore();

/**
 * Register a computed output: every <Out name={out}> element on the page shows `fn(inputs)`.
 * Re-evaluates when any input changes.
 */
export function compute(out: string, inputs: string[], fn: (v: Record<string, number>) => string) {
  const update = () => {
    const vals: Record<string, number> = {};
    for (const k of inputs) vals[k] = vars.get(k);
    const text = fn(vals);
    document.querySelectorAll<HTMLElement>(`.out[data-out="${out}"]`).forEach((el) => (el.textContent = text));
  };
  for (const k of inputs) vars.subscribe(k, update);
  update();
}
