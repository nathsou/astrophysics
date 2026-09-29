import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FALLBACK, SIGNAL_TOKENS, mix, parseColor, readSignals, voltColor, withAlpha, type SignalName } from './signals';

const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');

/** `--name: light-dark(a, b);` in app.css → [a, b]. */
function tokenPair(name: string): [string, string] | undefined {
  const m = new RegExp(`${name}:\\s*light-dark\\(\\s*(#[0-9a-f]{3,8}|rgb\\([^)]*\\))\\s*,\\s*(#[0-9a-f]{3,8}|rgb\\([^)]*\\))\\s*\\)`, 'i').exec(css);
  return m ? [m[1]!, m[2]!] : undefined;
}

const same = (a: string, b: string) => {
  const [x, y] = [parseColor(a), parseColor(b)];
  return x.every((v, i) => Math.abs(v - y[i]!) < 0.011);
};

describe('signal tokens', () => {
  it('fallbacks match the light-dark() values in app.css', () => {
    let checked = 0;
    for (const [name, token] of Object.entries(SIGNAL_TOKENS) as [SignalName, string][]) {
      const pair = tokenPair(token);
      if (!pair) continue; // single colours (e.g. --scope-grid)
      checked++;
      expect(same(FALLBACK.light[name], pair[0]), `${token} light`).toBe(true);
      expect(same(FALLBACK.dark[name], pair[1]), `${token} dark`).toBe(true);
    }
    expect(checked).toBeGreaterThanOrEqual(20);
  });

  it('every signal token is defined in app.css', () => {
    for (const token of Object.values(SIGNAL_TOKENS)) expect(css).toContain(`${token}:`);
  });

  it('readSignals falls back outside the browser', () => {
    expect(readSignals()).toEqual(FALLBACK.light);
  });
});

describe('colour helpers', () => {
  it('parses hex and rgb()', () => {
    expect(parseColor('#c27000')).toEqual([194, 112, 0, 1]);
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1]);
    expect(parseColor('rgb(1, 2, 3)')).toEqual([1, 2, 3, 1]);
    expect(parseColor('rgba(1, 2, 3, 0.5)')).toEqual([1, 2, 3, 0.5]);
    expect(parseColor('rgb(1 2 3 / 0.25)')).toEqual([1, 2, 3, 0.25]);
  });

  it('mixes linearly and clamps', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('rgba(128, 128, 128, 1)');
    expect(mix('#000000', '#ffffff', 2)).toBe('rgba(255, 255, 255, 1)');
    expect(withAlpha('#ff0000', 0.3)).toBe('rgba(255, 0, 0, 0.3)');
  });

  it('maps voltages onto the diverging scale', () => {
    const s = { voltNeg: '#0000ff', voltZero: '#808080', voltPos: '#ff0000' };
    expect(voltColor(0, s)).toBe('rgba(128, 128, 128, 1)');
    expect(voltColor(5, s)).toBe('rgba(255, 0, 0, 1)');
    expect(voltColor(-5, s)).toBe('rgba(0, 0, 255, 1)');
    expect(voltColor(12, s)).toBe('rgba(255, 0, 0, 1)');
    expect(voltColor(2.5, s, 0, 5)).toBe(mix('#808080', '#ff0000', 0.5));
  });
});
