// Minimal marching-squares contour extractor for a scalar field sampled on a regular grid.
// Returns line segments in grid-index space (fractional), which callers map to screen/data coords.

export interface Grid {
  nx: number;
  ny: number;
  /** field[j*nx+i] = value at (i, j) */
  field: Float32Array | Float64Array;
}

export type Segment = [number, number, number, number]; // x0,y0,x1,y1 in fractional grid coords

const lerp = (a: number, b: number, va: number, vb: number, level: number) =>
  va === vb ? a : a + ((level - va) / (vb - va)) * (b - a);

/** Extract all contour segments at `level` from `grid`. */
export function marchingSquares(grid: Grid, level: number): Segment[] {
  const { nx, ny, field } = grid;
  const segs: Segment[] = [];
  const at = (i: number, j: number) => field[j * nx + i];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v00 = at(i, j), v10 = at(i + 1, j), v11 = at(i + 1, j + 1), v01 = at(i, j + 1);
      const c0 = v00 >= level, c1 = v10 >= level, c2 = v11 >= level, c3 = v01 >= level;
      const idx = (+c0) | (+c1 << 1) | (+c2 << 2) | (+c3 << 3);
      if (idx === 0 || idx === 15) continue;
      // edge midpoints via linear interpolation, indexed by side: 0=bottom,1=right,2=top,3=left
      const eB = (): [number, number] => [lerp(i, i + 1, v00, v10, level), j];
      const eR = (): [number, number] => [i + 1, lerp(j, j + 1, v10, v11, level)];
      const eT = (): [number, number] => [lerp(i, i + 1, v01, v11, level), j + 1];
      const eL = (): [number, number] => [i, lerp(j, j + 1, v00, v01, level)];
      const push = (a: [number, number], b: [number, number]) => segs.push([a[0], a[1], b[0], b[1]]);
      switch (idx) {
        case 1: case 14: push(eL(), eB()); break;
        case 2: case 13: push(eB(), eR()); break;
        case 3: case 12: push(eL(), eR()); break;
        case 4: case 11: push(eR(), eT()); break;
        case 6: case 9: push(eB(), eT()); break;
        case 7: case 8: push(eL(), eT()); break;
        case 5: push(eL(), eB()); push(eR(), eT()); break; // saddle: two plausible connections
        case 10: push(eL(), eT()); push(eB(), eR()); break;
      }
    }
  }
  return segs;
}
