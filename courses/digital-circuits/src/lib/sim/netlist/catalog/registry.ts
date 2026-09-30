import type { ComponentDef, Params, PinDef, Placed, Rot } from '../types';

const registry = new Map<string, ComponentDef>();

/** Add catalog entries. Each catalog file calls this once at import time. */
export function defineComponents(defs: ComponentDef[]): void {
  for (const d of defs) {
    if (registry.has(d.type)) throw new Error(`catalog: duplicate component type "${d.type}"`);
    registry.set(d.type, d);
  }
}

export function getDef(type: string): ComponentDef | undefined {
  return registry.get(type);
}

export function allDefs(): ComponentDef[] {
  return [...registry.values()];
}

/** Parameters with catalog defaults filled in. */
export function withDefaults(def: ComponentDef, params: Params | undefined): Params {
  const out: Params = {};
  for (const p of def.params ?? []) out[p.key] = p.default;
  return { ...out, ...(params ?? {}) };
}

export function pinsOf(def: ComponentDef, params: Params): PinDef[] {
  return typeof def.pins === 'function' ? def.pins(params) : def.pins;
}

export function boundsOf(def: ComponentDef, params: Params): { x0: number; y0: number; x1: number; y1: number } {
  return typeof def.bounds === 'function' ? def.bounds(params) : def.bounds;
}

/** Map a point in a component's own coordinates to grid coordinates: flip, then rotate clockwise, then translate. */
export function transformPoint(p: { x: number; y: number }, c: Pick<Placed, 'x' | 'y' | 'rot' | 'flip'>): [number, number] {
  let x = c.flip ? -p.x : p.x;
  let y = p.y;
  const rot: Rot = c.rot ?? 0;
  for (let r = 0; r < rot; r += 90) [x, y] = [-y, x];
  return [c.x + x, c.y + y];
}
