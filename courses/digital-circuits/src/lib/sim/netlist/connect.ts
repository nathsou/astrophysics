import type { Circuit, ComponentDef, Connectivity, Params, PinDef, Placed } from './types';
import { getDef, pinsOf, transformPoint, withDefaults } from './catalog';

/**
 * Finds a subcircuit for a component type: "sub:<name>" in the circuit (or an enclosing one), or a
 * part from the parts bin ("part:<name>") via an external resolver.
 */
export type SubResolver = (type: string) => Circuit | undefined;

export function subResolver(circuit: Circuit, parent?: SubResolver, parts?: SubResolver): SubResolver {
  return (type) => {
    if (type.startsWith('sub:')) {
      const c = circuit.subcircuits?.[type.slice(4)];
      if (c) return c;
    }
    if (type.startsWith('part:') && parts) return parts(type);
    return parent?.(type);
  };
}

/** Catalog entry of a subcircuit block: ports become pins (inputs left, outputs right). */
export function subcircuitDef(type: string, sub: Circuit): ComponentDef {
  const ports = sub.components.filter((c) => c.type === 'port');
  const order = (a: Placed, b: Placed) => a.y - b.y || a.x - b.x;
  const left = ports.filter((p) => (p.params?.dir ?? 'in') !== 'out').sort(order);
  const right = ports.filter((p) => p.params?.dir === 'out').sort(order);
  const width = Math.max(6, 2 + 2 * Math.ceil(Math.max(...ports.map((p) => String(p.params?.name ?? p.id).length), 1) / 2));
  const pins: PinDef[] = [
    ...left.map((p, i) => ({ name: String(p.params?.name ?? p.id), x: 0, y: 2 * i, dir: (p.params?.dir ?? 'in') as 'in' | 'io' })),
    ...right.map((p, i) => ({ name: String(p.params?.name ?? p.id), x: width, y: 2 * i, dir: 'out' as const })),
  ];
  const rows = Math.max(left.length, right.length, 1);
  return {
    type,
    name: sub.title ?? type.replace(/^(sub|part):/, ''),
    category: 'block',
    pins,
    bounds: { x0: 0, y0: -1, x1: width, y1: 2 * rows - 1 },
    engines: ['analog', 'switch', 'digital'],
  };
}

/** Catalog entry for any placed component, including subcircuits. */
export function defOf(c: Placed, resolve?: SubResolver): ComponentDef {
  const def = getDef(c.type);
  if (def) return def;
  const sub = resolve?.(c.type);
  if (sub) return subcircuitDef(c.type, sub);
  throw new Error(`unknown component type "${c.type}" (${c.id})`);
}

export interface PlacedPin {
  component: string;
  pin: string;
  index: number;
  x: number;
  y: number;
}

/** Grid positions of every pin of a placed component. */
export function placedPins(c: Placed, resolve?: SubResolver): PlacedPin[] {
  const def = defOf(c, resolve);
  const params: Params = withDefaults(def, c.params);
  return pinsOf(def, params).map((p, index) => {
    const [x, y] = transformPoint(p, c);
    return { component: c.id, pin: p.name, index, x, y };
  });
}

class UnionFind {
  private parent = new Map<string, string>();
  find(a: string): string {
    let root = a;
    for (let p = this.parent.get(root); p !== undefined && p !== root; p = this.parent.get(root)) root = p;
    if (!this.parent.has(root)) this.parent.set(root, root);
    // Path compression.
    while (a !== root) {
      const next: string = this.parent.get(a) ?? root;
      this.parent.set(a, root);
      a = next;
    }
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

const pt = (x: number, y: number) => `${x},${y}`;

/** Is (x, y) strictly inside the axis-aligned segment a–b? */
function inside(x: number, y: number, a: [number, number], b: [number, number]): boolean {
  if (a[0] === b[0] && x === a[0]) return y > Math.min(a[1], b[1]) && y < Math.max(a[1], b[1]);
  if (a[1] === b[1] && y === a[1]) return x > Math.min(a[0], b[0]) && x < Math.max(a[0], b[0]);
  return false;
}

/** Global names: nets with these names are the same net everywhere, including inside subcircuits. */
export function globalName(c: Placed): string | undefined {
  if (c.type === 'ground') return 'GND';
  if (c.type === 'rail') return `rail:${Number(c.params?.voltage ?? 5)}`;
  return undefined;
}

/**
 * Resolve which pins and wires are connected. Wires connect along their whole length, to every pin
 * or wire end that touches one of their points, and to pins or wire ends lying on one of their
 * segments (T-junctions). Wires that merely cross do not connect. Labels with the same name, every
 * ground symbol, and rails of the same voltage are connected without wires.
 */
export function connect(circuit: Circuit, resolve?: SubResolver): Connectivity {
  resolve ??= subResolver(circuit);
  const uf = new UnionFind();
  const degree = new Map<string, number>();
  const bump = (k: string, d = 1) => degree.set(k, (degree.get(k) ?? 0) + d);

  const segments: { wire: number; a: [number, number]; b: [number, number] }[] = [];
  circuit.wires.forEach((w, i) => {
    const key = `wire:${i}`;
    w.points.forEach((p, j) => {
      uf.union(key, pt(p[0], p[1]));
      bump(pt(p[0], p[1]), j === 0 || j === w.points.length - 1 ? 1 : 2);
      if (j > 0) segments.push({ wire: i, a: w.points[j - 1]!, b: p });
    });
  });

  const pins: PlacedPin[] = [];
  for (const c of circuit.components) {
    for (const p of placedPins(c, resolve)) {
      pins.push(p);
      const key = `pin:${c.id}.${p.pin}`;
      uf.union(key, pt(p.x, p.y));
      bump(pt(p.x, p.y));
      if (c.type === 'label') uf.union(key, `name:${String(c.params?.name ?? '')}`);
      const g = globalName(c);
      if (g) uf.union(key, `name:${g}`);
    }
  }

  // Pins and wire ends lying on the inside of a segment join that wire (a T-junction).
  const ends: [number, number][] = [
    ...pins.map((p) => [p.x, p.y] as [number, number]),
    ...circuit.wires.flatMap((w) => (w.points.length ? [w.points[0]!, w.points[w.points.length - 1]!] : [])),
  ];
  for (const [x, y] of ends) {
    for (const s of segments) {
      if (inside(x, y, s.a, s.b)) {
        uf.union(pt(x, y), `wire:${s.wire}`);
        bump(pt(x, y), 2);
      }
    }
  }

  // Number the nets: one per root that owns a pin or a wire.
  const netOf = new Map<string, number>();
  const netNames: (string | undefined)[] = [];
  const net = (key: string) => {
    const root = uf.find(key);
    let n = netOf.get(root);
    if (n === undefined) {
      n = netNames.length;
      netOf.set(root, n);
      netNames.push(undefined);
    }
    return n;
  };

  const pinNet = new Map<string, number>();
  const members = new Map<number, number>();
  for (const p of pins) {
    const n = net(`pin:${p.component}.${p.pin}`);
    pinNet.set(`${p.component}.${p.pin}`, n);
    members.set(n, (members.get(n) ?? 0) + 1);
  }
  const wireNet = circuit.wires.map((_, i) => {
    const n = net(`wire:${i}`);
    members.set(n, (members.get(n) ?? 0) + 1);
    return n;
  });

  // Names: labels, ports, ground and rails.
  for (const c of circuit.components) {
    const n = pinNet.get(`${c.id}.${c.type === 'ground' ? 'g' : c.type === 'rail' ? 'v' : c.type === 'label' ? 'n' : c.type === 'port' ? 'p' : ''}`);
    if (n === undefined) continue;
    const name = c.type === 'ground' ? 'GND' : c.type === 'rail' ? `+${Number(c.params?.voltage ?? 5)}V` : String(c.params?.name ?? c.id);
    netNames[n] ??= name;
  }

  const junctions: [number, number][] = [];
  for (const [k, d] of degree) {
    if (d >= 3) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      junctions.push([x, y]);
    }
  }

  const named = new Set(circuit.components.filter((c) => c.type === 'label' || globalName(c)).map((c) => c.id));
  const unconnected = pins
    .filter((p) => !named.has(p.component) && members.get(pinNet.get(`${p.component}.${p.pin}`)!) === 1)
    .map((p) => `${p.component}.${p.pin}`);

  return { netCount: netNames.length, netNames, pinNet, wireNet, junctions, unconnected };
}
