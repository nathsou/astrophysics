/**
 * The attention output for one query,  o = Σᵢ softmax(s)ᵢ vᵢ  with scores  sᵢ = q·kᵢ / √d,  computed in a
 * single pass over blocks of `block` keys. Only one block's scores exist at a time: the running maximum,
 * the running sum of exponentials and the unnormalised output are rescaled whenever the maximum grows.
 * This is the idea at the heart of FlashAttention.
 */
export function attendOnline(q: Float32Array, K: Float32Array[], V: Float32Array[], block: number): Float32Array {
  const d = q.length, dv = V[0]!.length;
  const acc = new Float64Array(dv);
  let m = -Infinity, l = 0;
  for (let start = 0; start < K.length; start += block) {
    const end = Math.min(K.length, start + block);
    const s: number[] = [];
    for (let i = start; i < end; i++) {
      let dot = 0;
      for (let j = 0; j < d; j++) dot += q[j]! * K[i]![j]!;
      s.push(dot / Math.sqrt(d));
    }
    const mNew = Math.max(m, ...s);
    // Everything accumulated so far was relative to exp(m); re-express it relative to exp(mNew).
    const correction = Math.exp(m - mNew);
    l *= correction;
    for (let j = 0; j < dv; j++) acc[j]! *= correction;
    s.forEach((si, b) => {
      const p = Math.exp(si - mNew);
      l += p;
      const v = V[start + b]!;
      for (let j = 0; j < dv; j++) acc[j]! += p * v[j]!;
    });
    m = mNew;
  }
  return Float32Array.from(acc, (a) => a / l);
}
