export interface PowerLawFit {
  s: number;
  C: number;
  r2: number;
}

export function fitPowerLaw(xs: number[], ys: number[]): PowerLawFit {
  const pts: [number, number][] = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    if (xs[i]! > 0 && ys[i]! > 0) pts.push([Math.log(xs[i]!), Math.log(ys[i]!)]);
  }
  const n = pts.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  // Ordinary least squares: slope = cov(x, y) / var(x).
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const intercept = (sy - slope * sx) / n;
  const meanY = sy / n;
  let ssRes = 0, ssTot = 0;
  for (const [x, y] of pts) {
    ssRes += (y - (intercept + slope * x)) ** 2;
    ssTot += (y - meanY) ** 2;
  }
  return { s: -slope, C: Math.exp(intercept), r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}
