import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch08/saxpy',
  title: 'Your first kernel',
  starter,
  solution,
  tests,
  hints: [
    'Inside the kernel: <code>let i = gid.x;</code>, return early when <code>i >= p.n</code>, then <code>out[i] = p.a * x[i] + y[i];</code>',
    'On the host: <code>gpu.upload(x)</code> gives a buffer; <code>gpu.alloc(x.length * 4)</code> an output; <code>gpu.run({ code, uniforms: { spec: "uf", values: [n, a] }, buffers: [bx, by, bo], groups: [Math.ceil(n / 256)] })</code>; then <code>gpu.readFloat32(bo, n)</code>.',
  ],
} satisfies ExerciseSpec;
