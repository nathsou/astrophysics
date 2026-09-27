import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch12/safetensors',
  title: 'Write a checkpoint file',
  starter,
  solution,
  tests,
  hints: [
    'Build the header object first: for each tensor, <code>{ dtype: "F32", shape, data_offsets: [start, end] }</code>, with offsets in bytes relative to the start of the data.',
    'The file is: an 8-byte little-endian length (<code>new DataView(out.buffer).setBigUint64(0, BigInt(n), true)</code>), then the header JSON as UTF-8 (padded with spaces to a multiple of 8), then every tensor’s raw bytes in order.',
  ],
} satisfies ExerciseSpec;
