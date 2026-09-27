export function kneserNeyBigram(ids: number[], V: number, d: number): (prev: number, next: number) => number {
  const bigram = new Map<number, number>(); // key v·V + w
  for (let t = 0; t + 1 < ids.length; t++) {
    const key = ids[t]! * V + ids[t + 1]!;
    bigram.set(key, (bigram.get(key) ?? 0) + 1);
  }
  const ctxTotal = new Float64Array(V); // c(v •)
  const ctxTypes = new Float64Array(V); // N₁₊(v •)
  const precede = new Float64Array(V); // N₁₊(• w)
  for (const [key, c] of bigram) {
    const v = Math.floor(key / V), w = key % V;
    ctxTotal[v]! += c;
    ctxTypes[v]!++;
    precede[w]!++;
  }
  const types = bigram.size; // N₁₊(• •)
  const pCont = (w: number) => precede[w]! / types;

  return (v, w) => {
    const total = ctxTotal[v]!;
    if (total === 0) return pCont(w);
    const c = bigram.get(v * V + w) ?? 0;
    return Math.max(c - d, 0) / total + ((d * ctxTypes[v]!) / total) * pCont(w);
  };
}
