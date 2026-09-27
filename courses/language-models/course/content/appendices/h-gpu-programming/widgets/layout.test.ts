import { describe, expect, it } from 'vitest';
import { layoutStruct } from './layout.ts';

describe('WGSL struct layout', () => {
  it('pads a vec3f to a 16-byte boundary and packs a following f32 into its tail', () => {
    const { fields, size } = layoutStruct([{ name: 'a', type: 'f32' }, { name: 'v', type: 'vec3f' }, { name: 'b', type: 'f32' }], 'storage');
    expect(fields.map((f) => f.offset)).toEqual([0, 16, 28]);
    expect(size).toBe(32);
  });

  it('uses a 16-byte stride for arrays of f32 in uniform buffers only', () => {
    const u = layoutStruct([{ name: 'xs', type: 'array<f32, 4>' }], 'uniform');
    const s = layoutStruct([{ name: 'xs', type: 'array<f32, 4>' }], 'storage');
    expect(u.fields[0]!.stride).toBe(16);
    expect(u.size).toBe(64);
    expect(s.fields[0]!.stride).toBe(4);
    expect(s.size).toBe(16);
  });

  it('rounds a uniform struct up to 16 bytes', () => {
    expect(layoutStruct([{ name: 'n', type: 'u32' }], 'uniform').size).toBe(16);
    expect(layoutStruct([{ name: 'n', type: 'u32' }], 'storage').size).toBe(4);
  });
});
