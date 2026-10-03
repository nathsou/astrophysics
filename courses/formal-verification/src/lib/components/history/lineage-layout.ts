/**
 * Layout for the family tree of tools: x is the year, each lane is a horizontal band (the same lanes as the
 * timeline), and nodes that would overlap inside a band are stacked on sub-rows, greedily, in year order.
 * Deterministic and dependency-free, so the same data always draws the same picture.
 */
import { LANES, type Lane, type LineageEdge, type LineageNode } from './types';

export interface PlacedNode extends LineageNode {
  x: number;
  y: number;
  w: number;
}

export interface Band {
  lane: Lane;
  y: number;
  h: number;
}

export interface LineageLayout {
  nodes: PlacedNode[];
  edges: (LineageEdge & { d: string })[];
  bands: Band[];
  width: number;
  height: number;
  years: number[];
  x: (year: number) => number;
}

export const NODE_H = 22;
const ROW_GAP = 8;
const BAND_PAD = 10;
const CHAR_W = 6.6;

export function layoutLineage(nodes: LineageNode[], edges: LineageEdge[], opts: { pxPerYear?: number; left?: number } = {}): LineageLayout {
  const pxPerYear = opts.pxPerYear ?? 17;
  const left = opts.left ?? 20;
  const years = nodes.map((n) => n.year);
  const y0 = Math.floor((Math.min(...years, 1960) - 2) / 10) * 10;
  const y1 = Math.max(...years, 2020) + 4;
  const x = (year: number) => left + (year - y0) * pxPerYear;
  const width = x(y1) + 160;

  const placed: PlacedNode[] = [];
  const bands: Band[] = [];
  let top = 0;
  for (const lane of LANES) {
    const inLane = nodes.filter((n) => n.lane === lane).sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));
    if (!inLane.length) continue;
    const rowsEnd: number[] = [];
    for (const n of inLane) {
      const w = Math.max(44, n.name.length * CHAR_W + 18);
      const nx = x(n.year);
      let row = rowsEnd.findIndex((end) => end + 8 <= nx);
      if (row < 0) row = rowsEnd.push(-Infinity) - 1;
      rowsEnd[row] = nx + w;
      placed.push({ ...n, x: nx, y: top + BAND_PAD + row * (NODE_H + ROW_GAP), w });
    }
    const h = BAND_PAD * 2 + rowsEnd.length * (NODE_H + ROW_GAP) - ROW_GAP;
    bands.push({ lane, y: top, h });
    top += h;
  }

  const byId = new Map(placed.map((n) => [n.id, n]));
  const outEdges = edges.flatMap((e) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) return [];
    const ax = a.x + a.w;
    const ay = a.y + NODE_H / 2;
    const bx = b.x;
    const by = b.y + NODE_H / 2;
    // A forward edge curves right; an edge to an earlier or overlapping node leaves from the bottom.
    const d =
      bx > ax + 6
        ? `M${ax} ${ay} C${ax + (bx - ax) / 2} ${ay} ${ax + (bx - ax) / 2} ${by} ${bx} ${by}`
        : `M${a.x + a.w / 2} ${a.y + NODE_H} C${a.x + a.w / 2} ${by + (by > ay ? -30 : 30)} ${bx - 30} ${by} ${bx} ${by}`;
    return [{ ...e, d }];
  });
  const decades: number[] = [];
  for (let y = y0; y <= y1; y += 10) decades.push(y);
  return { nodes: placed, edges: outEdges, bands, width, height: top, years: decades, x };
}
