/**
 * Write tensors in the safetensors format (Hugging Face), float32 only:
 *   [8-byte little-endian header length n][n bytes of JSON header][raw tensor bytes …]
 * The header maps each name to { "dtype": "F32", "shape": [...], "data_offsets": [start, end] },
 * with byte offsets relative to the start of the data section, in the order written. Pad the JSON
 * with spaces so that 8 + n is a multiple of 8.
 */
export function encode(tensors: [string, { shape: number[]; data: Float32Array }][]): Uint8Array {
  const header: Record<string, unknown> = {};
  let offset = 0;
  for (const [name, t] of tensors) {
    header[name] = { dtype: 'F32', shape: t.shape, data_offsets: [offset, offset + t.data.byteLength] };
    offset += t.data.byteLength;
  }
  let json = JSON.stringify(header);
  json += ' '.repeat((8 - ((8 + json.length) % 8)) % 8);
  const h = new TextEncoder().encode(json);
  const out = new Uint8Array(8 + h.length + offset);
  new DataView(out.buffer).setBigUint64(0, BigInt(h.length), true);
  out.set(h, 8);
  let pos = 8 + h.length;
  for (const [, t] of tensors) {
    out.set(new Uint8Array(t.data.buffer, t.data.byteOffset, t.data.byteLength), pos);
    pos += t.data.byteLength;
  }
  return out;
}
