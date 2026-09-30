/** Seven-segment geometry and the hexadecimal font (bit 0 = segment a … bit 6 = g, bit 7 = dp). */

export const HEX_SEGMENTS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71];

/**
 * Paths of segments a–g for a digit in the box (x, y, w, h) with stroke thickness t: hexagonal
 * bars with small gaps at the joints, in the usual order a (top), b, c, d (bottom), e, f, g (middle).
 */
export function segmentPaths(x: number, y: number, w: number, h: number, t: number): string[] {
  const g = t * 0.18;
  const half = t / 2;
  const hBar = (x0: number, x1: number, yc: number) =>
    `M${x0 + g} ${yc} L${x0 + g + half} ${yc - half} L${x1 - g - half} ${yc - half} L${x1 - g} ${yc} L${x1 - g - half} ${yc + half} L${x0 + g + half} ${yc + half} Z`;
  const vBar = (xc: number, y0: number, y1: number) =>
    `M${xc} ${y0 + g} L${xc + half} ${y0 + g + half} L${xc + half} ${y1 - g - half} L${xc} ${y1 - g} L${xc - half} ${y1 - g - half} L${xc - half} ${y0 + g + half} Z`;
  const xl = x + half;
  const xr = x + w - half;
  const yt = y + half;
  const ym = y + h / 2;
  const yb = y + h - half;
  return [hBar(xl, xr, yt), vBar(xr, yt, ym), vBar(xr, ym, yb), hBar(xl, xr, yb), vBar(xl, ym, yb), vBar(xl, yt, ym), hBar(xl, xr, ym)].map((d) =>
    d.replace(/(\d+\.\d{3})\d+/g, '$1'),
  );
}
