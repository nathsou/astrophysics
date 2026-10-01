import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { dimuonMasses, parseDimuon } from './index.ts';
import { createHash } from 'node:crypto';

const file = new URL('../../../../static/data/dimuon.f32', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('../../../../static/data/dimuon.manifest.json', import.meta.url), 'utf8'));

describe('dimuon sample', () => {
  const buf = readFileSync(file);
  test('matches its manifest', () => {
    expect(createHash('sha256').update(buf).digest('hex')).toBe(manifest.sha256);
    expect(buf.byteLength).toBe(manifest.events * 40);
  });
  const d = parseDimuon(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  test('has 100,000 opposite-sign pairs', () => {
    expect(d.n).toBe(100000);
    for (let i = 0; i < 1000; i++) expect(d.q1(i) * d.q2(i)).toBe(-1);
  });
  test('the Z peak is at 91 GeV and the J/ψ at 3.1 GeV', () => {
    const m = dimuonMasses(d);
    const inWindow = (lo: number, hi: number) => m.filter((x) => x >= lo && x < hi).length;
    expect(inWindow(86, 96)).toBeGreaterThan(3 * inWindow(76, 81));
    expect(inWindow(3.0, 3.2)).toBeGreaterThan(5 * inWindow(2.6, 2.8));
  });
});
