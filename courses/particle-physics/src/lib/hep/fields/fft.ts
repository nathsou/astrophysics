/**
 * A small radix-2 fast Fourier transform, in place, on separate real and imaginary arrays.
 * Convention: X[k] = Σ_j x[j] exp(−2πi jk/N) (forward); the inverse has the opposite sign and divides by N.
 */

export function isPow2(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

/** In-place FFT of length n = a power of two. `stride`/`offset` let it work on a column of a matrix. */
export function fft(re: Float64Array, im: Float64Array, inverse = false, n = re.length, offset = 0, stride = 1): void {
  if (!isPow2(n)) throw new Error(`fft: length ${n} is not a power of two`);
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const a = offset + i * stride;
      const b = offset + j * stride;
      const tr = re[a]!; re[a] = re[b]!; re[b] = tr;
      const ti = im[a]!; im[a] = im[b]!; im[b] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = offset + (i + k) * stride;
        const b = offset + (i + k + len / 2) * stride;
        const xr = re[b]! * cr - im[b]! * ci;
        const xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[offset + i * stride] = re[offset + i * stride]! / n;
      im[offset + i * stride] = im[offset + i * stride]! / n;
    }
  }
}

/** 2D FFT of a row-major `rows × cols` array (both powers of two), in place. */
export function fft2(re: Float64Array, im: Float64Array, rows: number, cols: number, inverse = false): void {
  for (let r = 0; r < rows; r++) fft(re, im, inverse, cols, r * cols, 1);
  for (let c = 0; c < cols; c++) fft(re, im, inverse, rows, c, cols);
}

/** Hann window of length n (periodic form, so that it sums to n/2). */
export function hann(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}
