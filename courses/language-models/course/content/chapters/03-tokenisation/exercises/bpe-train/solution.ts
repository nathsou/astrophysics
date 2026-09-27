export function trainBpe(text: string, numMerges: number): [number, number][] {
  let ids = Array.from(new TextEncoder().encode(text));
  const merges: [number, number][] = [];
  for (let m = 0; m < numMerges; m++) {
    const counts = new Map<number, number>();
    for (let i = 0; i + 1 < ids.length; i++) {
      const k = ids[i]! * 65536 + ids[i + 1]!;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    let best = -1, bestCount = 0;
    for (const [k, c] of counts) {
      // Highest count; ties go to the smaller key, i.e. smaller first id then smaller second id.
      if (c > bestCount || (c === bestCount && k < best)) {
        best = k;
        bestCount = c;
      }
    }
    if (best < 0) break;
    const a = Math.floor(best / 65536), b = best % 65536, id = 256 + m;
    const out: number[] = [];
    for (let i = 0; i < ids.length; i++) {
      if (i + 1 < ids.length && ids[i] === a && ids[i + 1] === b) {
        out.push(id);
        i++;
      } else out.push(ids[i]!);
    }
    ids = out;
    merges.push([a, b]);
  }
  return merges;
}
