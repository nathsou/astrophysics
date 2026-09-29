/** The indices of the k documents most similar to the query by cosine similarity, most similar first. */
export function topK(query: number[], docs: number[][], k: number): number[] {
  // TODO
  return docs.slice(0, k).map((_, i) => i);
}
