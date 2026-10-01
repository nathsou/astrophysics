import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { PIPELINE_VERSION, PRESET_NAMES, parsePayload, payloadMatches, presetConfig, summarise } from '../hep/pipeline/index.ts';

const dir = join(process.cwd(), 'static', 'data', 'samples');

describe('the precomputed samples (static/data/samples, made by scripts/data/samples.ts)', () => {
  test('there is one for every preset, with a manifest, made with this version of the code, and within the size budget', () => {
    expect(existsSync(dir)).toBe(true);
    let total = 0;
    for (const name of PRESET_NAMES) {
      const file = join(dir, `${name}.json`);
      expect(existsSync(file), `${name}.json`).toBe(true);
      const text = readFileSync(file, 'utf8');
      total += text.length;
      const p = parsePayload(JSON.parse(text));
      const m = p.manifest;
      expect(m.preset).toBe(name);
      expect(m.seed).toBeTypeOf('number');
      expect(m.events).toBeGreaterThan(1000 - 1);
      expect(m.pipelineVersion).toBe(PIPELINE_VERSION);
      expect(m.codeSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(m.selection.length).toBeGreaterThan(20);
      expect(m.hooks).toEqual([]);
      expect(p.result.n).toBe(m.events);
      expect(Object.values(m.eventsPerSample).reduce((a, b) => a + b, 0)).toBe(m.events);
      // made with the preset as it is now, so the page shows it
      expect(payloadMatches(p, presetConfig(name)), `${name} is out of date: run scripts/data/samples.ts`).toBe(true);
      // and it can be read: scaled histograms, a fit where the preset has one, finite rates
      const s = summarise(p.result, p.config, p.xsec);
      expect(s.observables[0]!.total.counts.some((c) => c > 0)).toBe(true);
      expect(Number.isFinite(s.trigger.hltTotal)).toBe(true);
      if (p.config.analysis.fit) expect(s.fit?.converged).toBe(true);
    }
    expect(total).toBeLessThan(6 * 1024 * 1024);
  });

  test('index.json lists every file with its size and checksum', () => {
    const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as { files: { file: string; bytes: number; sha256: string }[] };
    expect(index.files.map((f) => f.file).sort()).toEqual(readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort());
    for (const f of index.files) {
      const buf = readFileSync(join(dir, f.file));
      expect(statSync(join(dir, f.file)).size).toBe(f.bytes);
      expect(createHash('sha256').update(buf).digest('hex')).toBe(f.sha256);
    }
  });

  test('the higgs-gamgam sample shows the peak: the fitted signal is significant and near 125 GeV', () => {
    const p = parsePayload(JSON.parse(readFileSync(join(dir, 'higgs-gamgam.json'), 'utf8')));
    const s = summarise(p.result, p.config, p.xsec);
    expect(s.fit!.reliable).toBe(true);
    expect(s.fit!.yieldSignificance!).toBeGreaterThan(4);
    expect(Math.abs(s.fit!.params['sig.mean']!.value - 125.25)).toBeLessThan(2);
    expect(s.window!.significance!).toBeGreaterThan(3);
  });
});
