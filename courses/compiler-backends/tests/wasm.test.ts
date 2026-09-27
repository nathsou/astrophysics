import { describe, expect, it } from 'vitest';
import { compile } from '../src/compiler/pipeline';
import { EXAMPLES } from '../src/examples';
import { lowerModule, runWasm } from '../src/compiler/wasm/wasm';
import { runModule } from '../src/compiler/ir/interp';

describe('wasm backend', () => {
  for (const ex of EXAMPLES) for (const opt of [0, 1, 2] as const) for (const stackify of [true, false]) {
    it(`${ex.id} O${opt} ${stackify ? 'stackified' : 'locals'}`, async () => {
      const r = compile(ex.src, { opt, asmOnly: true });
      expect(r.error).toBeUndefined();
      const ref = runModule(r.lowered!);
      const w = lowerModule(r.optimized!, { stackify });
      expect(WebAssembly.validate(w.bytes)).toBe(true);
      const out = await runWasm(w.bytes);
      expect(out.error).toBeUndefined();
      expect(out.output).toBe(ref.output);
      expect(out.exitCode).toBe(ref.exitCode);
    });
  }
});
