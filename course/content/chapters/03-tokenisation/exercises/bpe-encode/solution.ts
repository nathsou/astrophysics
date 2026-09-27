export function encode(text: string, merges: [number, number][]): number[] {
  const rank = new Map<string, number>();
  merges.forEach(([a, b], i) => rank.set(`${a},${b}`, i));
  let ids = Array.from(new TextEncoder().encode(text));
  for (;;) {
    let best = Infinity;
    for (let i = 0; i + 1 < ids.length; i++) {
      const r = rank.get(`${ids[i]},${ids[i + 1]}`);
      if (r !== undefined && r < best) best = r;
    }
    if (best === Infinity) return ids;
    const [a, b] = merges[best]!;
    const out: number[] = [];
    for (let i = 0; i < ids.length; i++) {
      if (i + 1 < ids.length && ids[i] === a && ids[i + 1] === b) {
        out.push(256 + best);
        i++;
      } else out.push(ids[i]!);
    }
    ids = out;
  }
}

export function decode(ids: number[], merges: [number, number][]): string {
  const table: number[][] = [];
  for (let b = 0; b < 256; b++) table.push([b]);
  for (const [a, b] of merges) table.push([...table[a]!, ...table[b]!]);
  return new TextDecoder().decode(new Uint8Array(ids.flatMap((i) => table[i]!)));
}
