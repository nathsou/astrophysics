export function broadcastShapes(a: number[], b: number[]): number[] {
  const n = Math.max(a.length, b.length);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = a[a.length - n + i] ?? 1;
    const y = b[b.length - n + i] ?? 1;
    if (x !== y && x !== 1 && y !== 1) throw new Error(`cannot broadcast [${a}] with [${b}]`);
    out.push(x === 1 ? y : x);
  }
  return out;
}
