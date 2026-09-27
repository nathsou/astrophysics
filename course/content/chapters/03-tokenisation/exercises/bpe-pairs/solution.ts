export function countPairs(ids: number[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i + 1 < ids.length; i++) {
    const key = `${ids[i]},${ids[i + 1]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function mergePair(ids: number[], a: number, b: number, newId: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < ids.length; i++) {
    if (i + 1 < ids.length && ids[i] === a && ids[i + 1] === b) {
      out.push(newId);
      i++; // skip the second element of the pair
    } else {
      out.push(ids[i]!);
    }
  }
  return out;
}
