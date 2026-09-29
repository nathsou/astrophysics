/**
 * The canvas view: a pan and zoom over the schematic. Coordinates are "world" pixels (grid × GRID_PX,
 * the units of the renderer's SVG) and screen pixels of the canvas element. The view is the world
 * position of the canvas's top-left corner and the zoom (screen pixels per world pixel).
 */
import { G } from '../geometry';
import type { Box } from '../geometry';

export interface View {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 4;
export const DEFAULT_ZOOM = 1.5;

export const clampZoom = (z: number): number => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

export function toWorld(v: View, sx: number, sy: number): [number, number] {
  return [v.x + sx / v.zoom, v.y + sy / v.zoom];
}

export function toScreen(v: View, wx: number, wy: number): [number, number] {
  return [(wx - v.x) * v.zoom, (wy - v.y) * v.zoom];
}

/** Grid coordinates (fractional) of a screen point. */
export function toGrid(v: View, sx: number, sy: number): [number, number] {
  const [wx, wy] = toWorld(v, sx, sy);
  return [wx / G, wy / G];
}

export const snap = (g: number): number => Math.round(g);

/** Zoom by `factor` keeping the world point under the screen point (sx, sy) fixed. */
export function zoomAt(v: View, sx: number, sy: number, factor: number): View {
  const zoom = clampZoom(v.zoom * factor);
  const [wx, wy] = toWorld(v, sx, sy);
  return { zoom, x: wx - sx / zoom, y: wy - sy / zoom };
}

/** Pan by a screen offset. */
export const panBy = (v: View, dsx: number, dsy: number): View => ({ ...v, x: v.x - dsx / v.zoom, y: v.y - dsy / v.zoom });

/**
 * A view showing a box (grid units) centred in a canvas of w × h pixels, with `margin` pixels around;
 * never zoomed in beyond `maxZoom` (small circuits are not blown up).
 */
export function fitBox(box: Box | undefined, w: number, h: number, margin = 48, maxZoom = 2): View {
  if (!box) return { x: -(w / DEFAULT_ZOOM - 40 * G) / 2, y: -(h / DEFAULT_ZOOM - 24 * G) / 2, zoom: DEFAULT_ZOOM };
  const bw = Math.max(1, (box.x1 - box.x0) * G);
  const bh = Math.max(1, (box.y1 - box.y0) * G);
  const zoom = clampZoom(Math.min(maxZoom, (w - 2 * margin) / bw, (h - 2 * margin) / bh));
  const cx = ((box.x0 + box.x1) / 2) * G;
  const cy = ((box.y0 + box.y1) / 2) * G;
  return { zoom, x: cx - w / zoom / 2, y: cy - h / zoom / 2 };
}

/** The visible world box of a canvas of w × h pixels (the renderer's viewBox). */
export function viewBox(v: View, w: number, h: number): Box {
  return { x0: v.x, y0: v.y, x1: v.x + w / v.zoom, y1: v.y + h / v.zoom };
}
