/**
 * WGSL memory layout rules (WGSL spec §"Memory Layout"), for the struct-layout widget.
 * Handles scalars, vectors, matrices and fixed-size arrays of those, in uniform or storage buffers.
 */
export type AddressSpace = 'uniform' | 'storage';

export interface TypeInfo {
  align: number;
  size: number;
}

const roundUp = (k: number, n: number) => Math.ceil(n / k) * k;

const BASE: Record<string, TypeInfo> = {
  f32: { align: 4, size: 4 },
  u32: { align: 4, size: 4 },
  i32: { align: 4, size: 4 },
  vec2f: { align: 8, size: 8 },
  vec3f: { align: 16, size: 12 },
  vec4f: { align: 16, size: 16 },
  mat2x2f: { align: 8, size: 16 },
  mat3x3f: { align: 16, size: 48 },
  mat4x4f: { align: 16, size: 64 },
};

export const TYPES = [...Object.keys(BASE), 'array<f32, 4>', 'array<vec3f, 2>'];

/** Alignment and size of a type in the given address space. */
export function typeInfo(type: string, space: AddressSpace): TypeInfo & { stride?: number } {
  const m = /^array<(\w+), (\d+)>$/.exec(type);
  if (m) {
    const el = BASE[m[1]!]!;
    const n = Number(m[2]);
    // Uniform buffers require array elements (and the array) to be 16-byte aligned.
    const align = space === 'uniform' ? roundUp(16, el.align) : el.align;
    const stride = space === 'uniform' ? roundUp(16, roundUp(el.align, el.size)) : roundUp(el.align, el.size);
    return { align, size: stride * n, stride };
  }
  const t = BASE[type];
  if (!t) throw new Error(`unknown type ${type}`);
  return t;
}

export interface FieldLayout {
  name: string;
  type: string;
  offset: number;
  size: number;
  align: number;
  /** Padding inserted before this field. */
  padBefore: number;
  stride?: number;
}

/** Lay out a struct's fields; returns the fields and the struct's total size and alignment. */
export function layoutStruct(fields: { name: string; type: string }[], space: AddressSpace): { fields: FieldLayout[]; size: number; align: number } {
  let offset = 0;
  let structAlign = 1;
  const out: FieldLayout[] = [];
  for (const f of fields) {
    const t = typeInfo(f.type, space);
    const start = roundUp(t.align, offset);
    out.push({ name: f.name, type: f.type, offset: start, size: t.size, align: t.align, padBefore: start - offset, stride: t.stride });
    offset = start + t.size;
    structAlign = Math.max(structAlign, t.align);
  }
  if (space === 'uniform') structAlign = roundUp(16, structAlign);
  return { fields: out, size: roundUp(structAlign, offset), align: structAlign };
}
