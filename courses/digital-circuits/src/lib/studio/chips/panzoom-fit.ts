/** The pure arithmetic of PanZoom's initial view, kept apart so it can be tested. */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface ViewState {
  k: number;
  tx: number;
  ty: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Scale and offset that show the whole `width` × `height` content, centred, in a `w` × `h` pane. */
export function fitAll(w: number, h: number, width: number, height: number, pad = 12, minK = 0.05, maxK = 14): ViewState {
  const k = clamp(Math.min((w - 2 * pad) / width, (h - 2 * pad) / height), minK, maxK);
  return { k, tx: (w - width * k) / 2, ty: Math.max(pad, (h - height * k) / 2) };
}

/** Scale and offset that show the content rectangle `r` filling the pane. */
export function fitRect(w: number, h: number, r: Rect, pad = 12, minK = 0.05, maxK = 14): ViewState {
  const k = clamp(Math.min((w - 2 * pad) / r.w, (h - 2 * pad) / r.h), minK, maxK);
  return { k, tx: (w - r.w * k) / 2 - r.x * k, ty: (h - r.h * k) / 2 - r.y * k };
}

/**
 * The view a fresh (or resized) pane opens on: all the content, unless that would be smaller than `minFit`
 * (unreadable) and a `home` rectangle is given, in which case the pane opens on `home`. `all` forces the
 * whole content (the reader pressed Fit).
 */
export function initialView(w: number, h: number, width: number, height: number, opts: { home?: Rect; minFit?: number; all?: boolean; minK?: number; maxK?: number } = {}): ViewState {
  const { home, minFit = 0, all = false, minK, maxK } = opts;
  const whole = fitAll(w, h, width, height, 12, minK, maxK);
  if (home && !all && whole.k < minFit) return fitRect(w, h, home, 12, minK, maxK);
  return whole;
}
