/** The indices of the k documents most similar to the query by cosine similarity, most similar first. */
export function topK(query: number[], docs: number[][], k: number): number[] {
  const norm = (v: number[]) => Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  const q = norm(query);
  const scores = docs.map((d) => {
    const n = norm(d) * q;
    return n === 0 ? 0 : d.reduce((a, x, i) => a + x * query[i]!, 0) / n;
  });
  return scores
    .map((_, i) => i)
    .sort((a, b) => scores[b]! - scores[a]! || a - b)
    .slice(0, k);
}
