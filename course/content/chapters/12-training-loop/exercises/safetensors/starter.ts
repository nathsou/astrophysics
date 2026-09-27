/**
 * Write tensors in the safetensors format (Hugging Face), float32 only:
 *   [8-byte little-endian header length n][n bytes of JSON header][raw tensor bytes …]
 * The header maps each name to { "dtype": "F32", "shape": [...], "data_offsets": [start, end] },
 * with byte offsets relative to the start of the data section, in the order written. Pad the JSON
 * with spaces so that 8 + n is a multiple of 8.
 */
export function encode(tensors: [string, { shape: number[]; data: Float32Array }][]): Uint8Array {
  // TODO
  return new Uint8Array(0);
}
