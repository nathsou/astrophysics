/**
 * Principal component analysis by power iteration with deflation — enough to project embedding
 * tables (hundreds of rows, tens to hundreds of columns) to 2-D for visualisation.
 */
import { mulberry32 } from './random.ts';

export interface Pca {
  /** Row-major (rows × k) projections of the centred data onto the components. */
  projected: Float64Array;
  /** k unit-length component vectors, each of length `cols`. */
  components: Float64Array[];
  /** Variance captured by each component. */
  variances: number[];
  /** Fraction of total variance captured by each component. */
  explained: number[];
}

export function pca(data: ArrayLike<number>, rows: number, cols: number, k = 2, iters = 200): Pca {
  // Centre the columns.
  const mean = new Float64Array(cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) mean[c]! += data[r * cols + c]! / rows;
  // Covariance matrix (cols × cols).
  const cov = new Float64Array(cols * cols);
  let total = 0;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      const xi = data[r * cols + i]! - mean[i]!;
      for (let j = i; j < cols; j++) cov[i * cols + j]! += (xi * (data[r * cols + j]! - mean[j]!)) / Math.max(1, rows - 1);
    }
  }
  for (let i = 0; i < cols; i++) {
    total += cov[i * cols + i]!;
    for (let j = 0; j < i; j++) cov[i * cols + j] = cov[j * cols + i]!;
  }
  const rng = mulberry32(42);
  const components: Float64Array[] = [];
  const variances: number[] = [];
  for (let c = 0; c < k; c++) {
    let v = Float64Array.from({ length: cols }, () => rng() - 0.5);
    let lambda = 0;
    for (let it = 0; it < iters; it++) {
      const w = new Float64Array(cols);
      for (let i = 0; i < cols; i++) for (let j = 0; j < cols; j++) w[i]! += cov[i * cols + j]! * v[j]!;
      const norm = Math.hypot(...w) || 1;
      lambda = norm;
      v = w.map((x) => x / norm);
    }
    // Deflate: remove this component's contribution so the next iteration finds the next one.
    for (let i = 0; i < cols; i++) for (let j = 0; j < cols; j++) cov[i * cols + j]! -= lambda * v[i]! * v[j]!;
    components.push(v);
    variances.push(lambda);
  }
  const projected = new Float64Array(rows * k);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < k; c++) {
      let s = 0;
      for (let j = 0; j < cols; j++) s += (data[r * cols + j]! - mean[j]!) * components[c]![j]!;
      projected[r * k + c] = s;
    }
  return { projected, components, variances, explained: variances.map((x) => (total > 0 ? x / total : 0)) };
}

/** Cosine similarity between rows a and b of a row-major matrix. */
export function cosineRows(data: ArrayLike<number>, cols: number, a: number, b: number): number {
  let dot = 0, na = 0, nb = 0;
  for (let j = 0; j < cols; j++) {
    const x = data[a * cols + j]!, y = data[b * cols + j]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return dot / (Math.sqrt(na * nb) || 1);
}
