/**
 * The state and operations of the exercise editor, without any UI: a circuit with undo history and a
 * selection, and the edits a reader makes (place, move, rotate, delete, connect two pins, swap a part).
 * Everything goes through the bench editor's pure operations (`bench/editor/ops.ts`), so a circuit
 * edited here behaves exactly as on the bench. `EditorState` (in `editor.svelte.ts`) makes it reactive.
 */
import type { Circuit, ParamValue, Placed } from '$lib/sim/netlist/types';
import { connect as connectNets, subResolver, placedPins, type SubResolver } from '$lib/sim/netlist/connect';
import { getDef } from '$lib/sim/netlist/catalog';
import { addWire, emptySelection, freeOffset, moveSelection, normalise, place, removeSelection, renameId, replaceComponents, rotateSelection, mirrorSelection, setParam, type Selection } from '$lib/bench/editor/ops';
import { canRedo, canUndo, commit, createHistory, redo, undo, type History } from '$lib/bench/editor/history';
import { layoutOf, type Pt } from '$lib/bench/editor/layout';
import { routeL } from '$lib/bench/editor/route';

export interface PinRef {
  /** "U1.A" */
  ref: string;
  comp: string;
  pin: string;
  x: number;
  y: number;
  /** Human text for a list: "U1 (AND) A" */
  label: string;
}

export class EditorCore {
  history: History<Circuit>;
  selection: Selection = emptySelection;
  private readonly resolve: SubResolver;

  constructor(
    start: Circuit,
    private readonly options: { parts?: SubResolver; locked?: (c: Placed) => boolean } = {},
  ) {
    this.resolve = (type) => (type.startsWith('part:') ? options.parts?.(type) : undefined);
    this.history = createHistory(normalise(start, this.resolverFor(start)));
  }

  private resolverFor(c: Circuit): SubResolver {
    return subResolver(c, undefined, this.options.parts);
  }

  get circuit(): Circuit {
    return this.history.present;
  }
  get canUndo(): boolean {
    return canUndo(this.history);
  }
  get canRedo(): boolean {
    return canRedo(this.history);
  }

  /** The resolver for parts-bin types in this circuit. */
  resolver(): SubResolver {
    return this.resolverFor(this.circuit);
  }

  private commitNext(next: Circuit, key?: string): void {
    if (next === this.circuit) return;
    this.history = commit(this.history, next, { key });
    const ids = new Set(next.components.map((c) => c.id));
    this.selection = { ids: new Set([...this.selection.ids].filter((i) => ids.has(i))), wires: new Set([...this.selection.wires].filter((i) => i < next.wires.length)) };
  }

  reset(circuit: Circuit): void {
    this.history = createHistory(normalise(circuit, this.resolverFor(circuit)));
    this.selection = emptySelection;
  }
  undo(): void {
    this.history = undo(this.history);
    this.selection = emptySelection;
  }
  redo(): void {
    this.history = redo(this.history);
    this.selection = emptySelection;
  }

  select(ids: string[], wires: number[] = []): void {
    this.selection = { ids: new Set(ids), wires: new Set(wires) };
  }
  clearSelection(): void {
    this.selection = emptySelection;
  }

  /** Place a part. Without a position it goes to the first free spot near the middle of the drawing. */
  place(type: string, at?: Pt, options: { rot?: 0 | 90 | 180 | 270; params?: Record<string, ParamValue> } = {}): string {
    let [x, y] = at ?? this.freeSpot();
    if (!at) {
      const [dx, dy] = freeOffset(this.circuit, { components: [{ id: '_', type, x, y }], wires: [] }, 0, 0, this.resolver());
      x += dx;
      y += dy;
    }
    const r = place(this.circuit, type, x, y, options, this.resolver());
    this.commitNext(r.circuit);
    this.selection = { ids: new Set([r.id]), wires: new Set() };
    return r.id;
  }

  private freeSpot(): Pt {
    const xs = this.circuit.components.filter((c) => c.type !== 'port').map((c) => c.x);
    const ports = this.circuit.components.filter((c) => c.type === 'port');
    const left = ports.filter((p) => p.params?.dir !== 'out');
    const right = ports.filter((p) => p.params?.dir === 'out');
    const lo = left.length ? Math.max(...left.map((p) => p.x)) + 6 : 4;
    const hi = right.length ? Math.min(...right.map((p) => p.x)) - 10 : lo + 30;
    return [Math.round(xs.length ? Math.min(hi, Math.max(lo, (lo + hi) / 2)) : (lo + hi) / 2), 2];
  }

  /** Move the selection by a grid offset. */
  nudge(dx: number, dy: number): void {
    if (!this.selection.ids.size && !this.selection.wires.size) return;
    this.commitNext(moveSelection(this.circuit, this.selection, dx, dy, this.resolver()), 'nudge');
  }
  /** Move the current selection by an offset as one undo step (the end of a drag). */
  nudgeSelectionTo(dx: number, dy: number): void {
    if (!dx && !dy) return;
    this.commitNext(moveSelection(this.circuit, this.selection, dx, dy, this.resolver()));
  }
  moveTo(ids: string[], dx: number, dy: number): void {
    this.commitNext(moveSelection(this.circuit, { ids: new Set(ids), wires: new Set() }, dx, dy, this.resolver()));
  }

  rotate(): void {
    if (this.selection.ids.size) this.commitNext(rotateSelection(this.circuit, this.selection, this.resolver()));
  }
  mirror(): void {
    if (this.selection.ids.size) this.commitNext(mirrorSelection(this.circuit, this.selection, 'x', this.resolver()));
  }

  /** Delete the selection (locked parts, such as the pins of the part being built, stay). */
  remove(): void {
    const locked = this.options.locked;
    const ids = new Set([...this.selection.ids].filter((id) => !locked?.(this.circuit.components.find((c) => c.id === id)!)));
    if (!ids.size && !this.selection.wires.size) return;
    this.commitNext(removeSelection(this.circuit, { ids, wires: this.selection.wires }, this.resolver()));
    this.selection = emptySelection;
  }

  isLocked(id: string): boolean {
    const c = this.circuit.components.find((x) => x.id === id);
    return !!c && !!this.options.locked?.(c);
  }

  /** Every pin of every part, in reading order, for choosing wire ends with the keyboard. */
  pins(): PinRef[] {
    const out: PinRef[] = [];
    const layout = layoutOf(this.circuit, this.resolver());
    for (const l of [...layout.comps].sort((a, b) => a.c.y - b.c.y || a.c.x - b.c.x)) {
      for (const p of l.pins) out.push({ ref: `${l.c.id}.${p.pin}`, comp: l.c.id, pin: p.pin, x: p.x, y: p.y, label: `${l.c.id}${l.c.type === 'port' ? '' : ` (${l.def.name.replace(/ gate.*/i, '')})`} pin ${p.pin}` });
    }
    return out;
  }

  /**
   * Draw a wire between two pins ("U1.Y", "A.p"). The route is chosen so that it touches nothing else
   * (two wires that share a grid point are one net): L-shapes and Z-shapes with the vertical or horizontal
   * run at the first free position, and, when the drawing is too crowded for any, a pair of net labels.
   */
  connect(a: string, b: string): boolean {
    if (a === b) return false;
    const pins = this.pins();
    const pa = pins.find((p) => p.ref === a);
    const pb = pins.find((p) => p.ref === b);
    if (!pa || !pb) return false;
    const res = this.resolver();
    const before = connectNets(this.circuit, res);
    const same = before.pinNet.get(a) === before.pinNet.get(b);
    if (same) return false;
    for (const route of routeCandidates([pa.x, pa.y], [pb.x, pb.y])) {
      const next = addWire(this.circuit, route, res);
      const after = connectNets(next, res);
      // Exactly the two nets merged, and nothing else.
      if (after.pinNet.get(a) === after.pinNet.get(b) && after.netCount === before.netCount - 1) {
        this.commitNext(next);
        return true;
      }
    }
    // Labels: always safe.
    const name = this.freeNetName();
    let c = this.circuit;
    for (const p of [pa, pb]) {
      const stub: Pt = [p.x + (p.x >= 30 ? 2 : -2), p.y];
      c = place(c, 'label', stub[0], stub[1], { params: { name }, flip: p.x >= 30 ? undefined : true }, res).circuit;
      c = addWire(c, [[p.x, p.y], stub], res);
    }
    this.commitNext(c);
    return true;
  }

  private freeNetName(): string {
    const used = new Set(this.circuit.components.filter((c) => c.type === 'label').map((c) => String(c.params?.name)));
    for (let i = 1; ; i++) if (!used.has(`N${i}`)) return `N${i}`;
  }

  /** Add a wire along explicit grid points (from the canvas). */
  addWirePath(points: Pt[]): void {
    this.commitNext(addWire(this.circuit, points, this.resolver()));
  }

  removeWire(index: number): void {
    if (index < 0 || index >= this.circuit.wires.length) return;
    this.commitNext(removeSelection(this.circuit, { ids: new Set(), wires: new Set([index]) }, this.resolver()));
    this.selection = emptySelection;
  }

  /** Change a part to another type with the same pins (an AND to an OR): the fix for a wrong part. */
  swapType(id: string, type: string): boolean {
    const c = this.circuit.components.find((x) => x.id === id);
    if (!c || c.type === type || !getDef(type)) return false;
    const next: Placed = { ...c, type };
    const names = (p: Placed) => placedPins(p, this.resolver()).map((x) => `${x.pin}@${x.x},${x.y}`).join();
    try {
      // Parameters of the old type that mean nothing to the new one are dropped.
      const keep = new Set((getDef(type)!.params ?? []).map((p) => p.key));
      if (c.params) {
        const params = Object.fromEntries(Object.entries(c.params).filter(([k]) => keep.has(k)));
        if (Object.keys(params).length) next.params = params;
        else delete next.params;
      }
      if (names(next) !== names(c)) return false;
    } catch {
      return false;
    }
    this.commitNext(replaceComponents(this.circuit, new Map([[id, next]]), undefined, this.resolver()));
    return true;
  }

  setParam(id: string, key: string, value: ParamValue): void {
    this.commitNext(setParam(this.circuit, id, key, value, this.resolver()), `param:${id}:${key}`);
  }

  rename(id: string, to: string): boolean {
    const next = renameId(this.circuit, id, to);
    if (next === this.circuit) return false;
    this.commitNext(next);
    this.selection = { ids: new Set([to.trim()]), wires: new Set() };
    return true;
  }
}

/** Orthogonal routes from a to b, best first: straight or L-shaped, then Z-shapes with the middle run moved outwards from the centre. */
export function routeCandidates(a: Pt, b: Pt): Pt[][] {
  const out: Pt[][] = [routeL(a, b, 'h'), routeL(a, b, 'v')];
  const around = (lo: number, hi: number): number[] => {
    const mid = Math.round((lo + hi) / 2);
    const list: number[] = [mid];
    for (let d = 1; d <= Math.max(hi - lo, 4) + 4; d++) list.push(mid + d, mid - d);
    return list;
  };
  for (const mx of around(Math.min(a[0], b[0]), Math.max(a[0], b[0]))) out.push([a, [mx, a[1]], [mx, b[1]], b]);
  for (const my of around(Math.min(a[1], b[1]), Math.max(a[1], b[1]))) out.push([a, [a[0], my], [b[0], my], b]);
  return out;
}
