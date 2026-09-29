import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderTestResult, runTests } from './testbench';

const DIR = new URL('../../../content/designs/', import.meta.url);
const files = readdirSync(DIR).filter((f) => f.endsWith('.dcl')).sort();

describe('reference designs (content/designs)', () => {
  it('are all present', () => {
    expect(files).toEqual(['alu.dcl', 'counter.dcl', 'regfile.dcl', 'rv32i.dcl', 'traffic-light.dcl']);
  });

  for (const f of files) {
    it(`${f} checks and passes its tests`, () => {
      const source = readFileSync(new URL(f, DIR), 'utf8');
      const r = runTests(source, { file: f });
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      for (const t of r.results) expect(t.passed, renderTestResult(r.source, t)).toBe(true);
      if (f !== 'rv32i.dcl') {
        expect(r.diagnostics).toEqual([]);
        expect(r.results.length).toBeGreaterThan(0);
      } else {
        // The planning sample keeps its names: `riscv32` and the `zero1`/`zero12` constants.
        expect(r.diagnostics.map((d) => d.code)).toEqual(['naming', 'naming', 'naming']);
      }
    });
  }
});
