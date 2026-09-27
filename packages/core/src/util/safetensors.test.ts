import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeSafetensors, encodeSafetensors } from './safetensors.ts';

const fixture = (name: string) => new URL(`../../../../training/fixtures/${name}`, import.meta.url);

describe('safetensors', () => {
  it('round-trips tensors and metadata', () => {
    const tensors = new Map([
      ['a', { shape: [2, 3], data: Float32Array.from([1, 2, 3, 4, 5, 6]) }],
      ['b.c', { shape: [1], data: Float32Array.from([-0.5]) }],
    ]);
    const bytes = encodeSafetensors(tensors, { step: '42' });
    const header = Number(new DataView(bytes.buffer).getBigUint64(0, true));
    expect((8 + header) % 8).toBe(0);
    const back = decodeSafetensors(bytes);
    expect(back.metadata).toEqual({ step: '42' });
    expect([...back.tensors.keys()]).toEqual(['a', 'b.c']);
    expect(Array.from(back.tensors.get('a')!.data)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(back.tensors.get('a')!.shape).toEqual([2, 3]);
  });

  it('reads files written by PyTorch, in float32 and bfloat16', () => {
    const json = JSON.parse(readFileSync(fixture('gpt_parity.json'), 'utf8')) as { weights: Record<string, { shape: number[]; data: number[] }> };
    const f32 = decodeSafetensors(new Uint8Array(readFileSync(fixture('gpt_parity.safetensors'))));
    const bf16 = decodeSafetensors(new Uint8Array(readFileSync(fixture('gpt_parity_bf16.safetensors'))));
    expect(JSON.parse(f32.metadata.config!).width).toBe(16);
    for (const [name, w] of Object.entries(json.weights)) {
      const a = f32.tensors.get(name)!, b = bf16.tensors.get(name)!;
      expect(a.shape).toEqual(w.shape);
      w.data.forEach((v, i) => {
        expect(a.data[i]!).toBeCloseTo(v, 6);
        expect(Math.abs(b.data[i]! - v)).toBeLessThanOrEqual(Math.abs(v) / 128 + 1e-6); // 8 bits of precision
      });
    }
  });
});
