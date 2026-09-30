/**
 * The design hierarchy as a tree: modules (instance paths) → their RTL cells, each with the number of logic cells
 * the flow made from it. Built from the flow's source elements, so it exists for designs too big to draw as gates.
 */
import type { FpgaIndex } from './crossmap';

export interface HierCell {
  /** Source id (`Cpu.alu/add#12`). */
  id: string;
  kind: string;
  line?: number;
  /** Logic cells built from it (0: optimised away or absorbed into a neighbour's LUT). */
  cells: number;
}

export interface HierNode {
  /** Instance path (`Cpu.alu`). */
  path: string;
  /** Last component (`alu`). */
  name: string;
  depth: number;
  /** Logic cells in this module and below, and in this module alone. */
  total: number;
  own: number;
  /** The module's RTL cells, most expensive first. */
  cells: HierCell[];
  children: HierNode[];
}

/** The tree of modules with their cells. Several roots only if the paths do not share a first component. */
export function buildHierarchy(ix: FpgaIndex): HierNode[] {
  const byPath = new Map<string, HierNode>();
  const node = (path: string): HierNode => {
    let n = byPath.get(path);
    if (!n) {
      const i = path.lastIndexOf('.');
      n = { path, name: i < 0 ? path : path.slice(i + 1), depth: path.split('.').length - 1, total: 0, own: 0, cells: [], children: [] };
      byPath.set(path, n);
      if (i >= 0) node(path.slice(0, i)).children.push(n);
    }
    return n;
  };
  for (const p of ix.modulePaths) node(p);
  for (const s of ix.result.sources) {
    if (s.type === 'port') continue;
    const n = node(s.path);
    const cells = (ix.cellsBySource.get(s.id) ?? []).length;
    n.cells.push({ id: s.id, kind: s.type, line: s.line, cells });
  }
  // A cell built from several RTL cells counts for each; the totals count logic cells once.
  const seen = new Map<string, Set<number>>();
  ix.result.cells.forEach((c, i) => {
    for (const path of new Set(c.paths)) {
      let p: string | undefined = path;
      while (p !== undefined) {
        let s = seen.get(p);
        if (!s) seen.set(p, (s = new Set()));
        s.add(i);
        const j: number = p.lastIndexOf('.');
        p = j < 0 ? undefined : p.slice(0, j);
      }
    }
  });
  for (const n of byPath.values()) {
    n.total = seen.get(n.path)?.size ?? 0;
    const own = new Set<number>();
    ix.result.cells.forEach((c, i) => c.paths.includes(n.path) && own.add(i));
    n.own = own.size;
    n.cells.sort((a, b) => b.cells - a.cells || (a.line ?? 0) - (b.line ?? 0));
    n.children.sort((a, b) => b.total - a.total || a.path.localeCompare(b.path));
  }
  const roots = [...byPath.values()].filter((n) => n.depth === 0);
  return roots.sort((a, b) => b.total - a.total);
}

/** A module and everything below it, flattened in tree order (for keyboard navigation of the tree). */
export function flattenTree(roots: HierNode[], open: ReadonlySet<string>): HierNode[] {
  const out: HierNode[] = [];
  const visit = (n: HierNode) => {
    out.push(n);
    if (open.has(n.path)) n.children.forEach(visit);
  };
  roots.forEach(visit);
  return out;
}
