/** Geometry of the NAND gate on the sixth level (1.6 µm across, 400 px per µm; a 28 nm-generation cell). */
export const CELL = { x0: 230, x1: 410, y0: 20, y1: 380 };
export const P_DIFF = { x0: 236, x1: 404, y0: 92, y1: 160 };
export const N_DIFF = { x0: 236, x1: 404, y0: 240, y1: 308 };
/** Poly gates: centre x, width and extent. */
export const POLY_W = 12;
export const POLY_A = 285;
export const POLY_B = 355;
export const POLY_Y = { y0: 76, y1: 326 };
export const CONTACTS_P = [250, 320, 390];
export const CONTACTS_N = [250, 390];

/** The four channels: where a gate crosses a diffusion. */
export const CHANNELS = [
  { id: 'P1', kind: 'p', gate: 'A', x: POLY_A - POLY_W / 2, y: P_DIFF.y0, w: POLY_W, h: P_DIFF.y1 - P_DIFF.y0 },
  { id: 'P2', kind: 'p', gate: 'B', x: POLY_B - POLY_W / 2, y: P_DIFF.y0, w: POLY_W, h: P_DIFF.y1 - P_DIFF.y0 },
  { id: 'N1', kind: 'n', gate: 'A', x: POLY_A - POLY_W / 2, y: N_DIFF.y0, w: POLY_W, h: N_DIFF.y1 - N_DIFF.y0 },
  { id: 'N2', kind: 'n', gate: 'B', x: POLY_B - POLY_W / 2, y: N_DIFF.y0, w: POLY_W, h: N_DIFF.y1 - N_DIFF.y0 },
] as const;
