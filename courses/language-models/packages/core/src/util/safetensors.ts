/**
 * The safetensors file format (Hugging Face), for float32 tensors: an 8-byte little-endian header
 * length, a JSON header mapping names to { dtype, shape, data_offsets }, then the raw bytes.
 * Simple, safe to load (no code execution, unlike pickle) and readable from PyTorch with
 * `safetensors.torch.load_file`.
 */

export interface NamedTensor {
  shape: number[];
  data: Float32Array;
}

/** Encode tensors (and optional string metadata) as a safetensors file. */
export function encodeSafetensors(tensors: Map<string, NamedTensor>, metadata: Record<string, string> = {}): Uint8Array {
  const header: Record<string, unknown> = {};
  if (Object.keys(metadata).length) header.__metadata__ = metadata;
  let offset = 0;
  for (const [name, t] of tensors) {
    const size = t.shape.reduce((a, b) => a * b, 1);
    if (size !== t.data.length) throw new Error(`${name}: shape [${t.shape}] does not match ${t.data.length} values`);
    header[name] = { dtype: 'F32', shape: t.shape, data_offsets: [offset, offset + t.data.byteLength] };
    offset += t.data.byteLength;
  }
  // Pad the header with spaces so the data starts on an 8-byte boundary.
  let json = JSON.stringify(header);
  json += ' '.repeat((8 - ((8 + json.length) % 8)) % 8);
  const headerBytes = new TextEncoder().encode(json);
  const out = new Uint8Array(8 + headerBytes.length + offset);
  new DataView(out.buffer).setBigUint64(0, BigInt(headerBytes.length), true);
  out.set(headerBytes, 8);
  let pos = 8 + headerBytes.length;
  for (const t of tensors.values()) {
    out.set(new Uint8Array(t.data.buffer, t.data.byteOffset, t.data.byteLength), pos);
    pos += t.data.byteLength;
  }
  return out;
}

/** Decode a safetensors file of F32 (or F16/BF16, converted to float32) tensors. */
export function decodeSafetensors(bytes: Uint8Array): { tensors: Map<string, NamedTensor>; metadata: Record<string, string> } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = Number(view.getBigUint64(0, true));
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + n))) as Record<string, { dtype: string; shape: number[]; data_offsets: [number, number] }> & { __metadata__?: Record<string, string> };
  const base = 8 + n;
  const tensors = new Map<string, NamedTensor>();
  for (const [name, info] of Object.entries(header)) {
    if (name === '__metadata__') continue;
    const { dtype, shape, data_offsets: [start, end] } = info as { dtype: string; shape: number[]; data_offsets: [number, number] };
    const raw = bytes.slice(base + start, base + end); // copy, so the array is aligned
    let data: Float32Array;
    if (dtype === 'F32') data = new Float32Array(raw.buffer);
    else if (dtype === 'F16' || dtype === 'BF16') {
      const u16 = new Uint16Array(raw.buffer);
      data = Float32Array.from(u16, dtype === 'BF16' ? bf16ToF32 : f16ToF32);
    } else throw new Error(`${name}: unsupported dtype ${dtype}`);
    tensors.set(name, { shape, data });
  }
  return { tensors, metadata: header.__metadata__ ?? {} };
}

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

function bf16ToF32(h: number): number {
  u32[0] = h << 16; // bfloat16 is the top half of a float32
  return f32[0]!;
}

function f16ToF32(h: number): number {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}
