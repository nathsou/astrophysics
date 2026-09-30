/** The exercise editor as reactive state: `EditorCore` (pure, tested) plus what the canvas shows and remembers. */
import type { Circuit, ParamValue, Placed } from '$lib/sim/netlist/types';
import type { SubResolver } from '$lib/sim/netlist/connect';
import { emptySelection, type Selection } from '$lib/bench/editor/ops';
import type { Pt } from '$lib/bench/editor/layout';
import { fitBox, type View } from '$lib/bench/editor/view';
import { circuitBox, layoutOf } from '$lib/bench/editor/layout';
import { EditorCore, type PinRef } from './editor-core';

export type Tool = 'select' | 'wire';

export class EditorState {
  readonly core: EditorCore;
  circuit = $state.raw<Circuit>({ version: 1, components: [], wires: [] });
  /** A circuit being dragged (not yet committed). */
  draft = $state.raw<Circuit | null>(null);
  selection = $state.raw<Selection>(emptySelection);
  canUndo = $state(false);
  canRedo = $state(false);
  tool = $state<Tool>('select');
  /** The catalog type being placed (the next click on the canvas puts it down). */
  placing = $state<string | null>(null);
  view = $state<View>({ x: 0, y: 0, zoom: 1.5 });
  viewport = $state({ w: 600, h: 320 });
  /** Bumped by every change, so effects can react to edits. */
  revision = $state(0);
  private fitted = false;

  constructor(
    start: Circuit,
    options: { parts?: SubResolver; locked?: (c: Placed) => boolean } = {},
  ) {
    this.core = new EditorCore(start, options);
    this.sync();
  }

  get shown(): Circuit {
    return this.draft ?? this.circuit;
  }

  private sync(): void {
    this.circuit = this.core.circuit;
    this.selection = this.core.selection;
    this.canUndo = this.core.canUndo;
    this.canRedo = this.core.canRedo;
    this.draft = null;
    this.revision++;
  }

  /** Run an edit on the core and refresh. */
  edit(fn: (core: EditorCore) => void): void {
    fn(this.core);
    this.sync();
  }

  place(type: string, at?: Pt): string {
    let id = '';
    this.edit((c) => (id = c.place(type, at)));
    return id;
  }
  select(ids: string[], wires: number[] = []): void {
    this.core.select(ids, wires);
    this.selection = this.core.selection;
  }
  clearSelection(): void {
    this.select([]);
  }
  undo = () => this.edit((c) => c.undo());
  redo = () => this.edit((c) => c.redo());
  remove = () => this.edit((c) => c.remove());
  rotate = () => this.edit((c) => c.rotate());
  mirror = () => this.edit((c) => c.mirror());
  nudge = (dx: number, dy: number) => this.edit((c) => c.nudge(dx, dy));
  connect = (a: string, b: string): boolean => {
    let ok = false;
    this.edit((c) => (ok = c.connect(a, b)));
    return ok;
  };
  removeWire = (i: number) => this.edit((c) => c.removeWire(i));
  swapType = (id: string, type: string): boolean => {
    let ok = false;
    this.edit((c) => (ok = c.swapType(id, type)));
    return ok;
  };
  setParam = (id: string, key: string, value: ParamValue) => this.edit((c) => c.setParam(id, key, value));
  reset = (circuit: Circuit) => {
    this.edit((c) => c.reset(circuit));
    this.fit();
  };
  pins(): PinRef[] {
    void this.revision;
    return this.core.pins();
  }

  /** Centre and scale the view on the drawing. */
  fit(): void {
    const box = circuitBox(this.circuit, layoutOf(this.circuit, this.core.resolver()));
    const roomy = box && { x0: box.x0 - 2, y0: box.y0 - 3, x1: box.x1 + 4, y1: box.y1 + 3 };
    this.view = fitBox(roomy, this.viewport.w, this.viewport.h, 24, 1.6);
  }

  resized(w: number, h: number): void {
    this.viewport = { w, h };
    if (!this.fitted && w > 60) {
      this.fitted = true;
      this.fit();
    }
  }
}
