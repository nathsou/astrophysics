import { describe, expect, test } from 'vitest';
import { CHANNEL_TOKENS, defaultConfig, isKind, markersOf, timeSpanOf, withDefaultConfig, type AnalyserConfig, type Instrument, type MultimeterConfig, type ScopeConfig } from './kinds';

const scope = (patch: Partial<ScopeConfig> = {}): Instrument => ({ id: 's', kind: 'scope', config: { ...(defaultConfig('scope') as ScopeConfig), ...patch } });

describe('instrument settings', () => {
  test('defaults: a scope has four channels with two on, an analyser eight', () => {
    const s = defaultConfig('scope') as ScopeConfig;
    expect(s.channels.map((c) => c.on)).toEqual([true, true, false, false]);
    expect(s.timebase).toBe(1e-3);
    expect((defaultConfig('analyser') as AnalyserConfig).channels).toHaveLength(8);
    expect(defaultConfig('multimeter')).toEqual({ mode: 'V' });
  });

  test('saved settings merge over the defaults, so partial or old saves still open', () => {
    const merged = withDefaultConfig('scope', { timebase: 5e-4, channels: [{ on: true, probe: { pin: 'R1.1' }, vdiv: 2, pos: 1 }], trigger: { level: 3 } }) as ScopeConfig;
    expect(merged.timebase).toBe(5e-4);
    expect(merged.channels).toHaveLength(4);
    expect(merged.channels[0]).toMatchObject({ on: true, probe: { pin: 'R1.1' }, vdiv: 2, pos: 1 });
    expect(merged.channels[3]).toMatchObject({ on: false, vdiv: 1 });
    expect(merged.trigger).toEqual({ source: 0, level: 3, slope: 'rise', mode: 'auto' });
    expect(withDefaultConfig('scope', 'nonsense')).toEqual(defaultConfig('scope'));
    expect((withDefaultConfig('analyser', { channels: [] }) as AnalyserConfig).channels).toHaveLength(8);
  });

  test('kinds are recognised', () => {
    expect(['multimeter', 'scope', 'analyser', 'logicprobe'].every(isKind)).toBe(true);
    expect(isKind('oscilloscope')).toBe(false);
  });
});

describe('probe flags', () => {
  test('a scope flags each channel that is on and attached, in the channel colour', () => {
    const s = scope();
    (s.config as ScopeConfig).channels[0]!.probe = { pin: 'R1.1' };
    (s.config as ScopeConfig).channels[1]!.probe = { at: [4, 4] };
    (s.config as ScopeConfig).channels[2]!.probe = { pin: 'C1.1' }; // off: no flag
    expect(markersOf(s)).toEqual([
      { ref: { pin: 'R1.1' }, label: '1', colour: CHANNEL_TOKENS[0] },
      { ref: { at: [4, 4] }, label: '2', colour: CHANNEL_TOKENS[1] },
    ]);
  });

  test('a multimeter flags its probes for the mode in use; ground has no flag', () => {
    const cfg: MultimeterConfig = { mode: 'V', plus: { pin: 'R1.2' }, minus: { net: 'GND' }, pin: { pin: 'R2.1' } };
    expect(markersOf({ id: 'm', kind: 'multimeter', config: cfg }).map((m) => m.label)).toEqual(['+']);
    expect(markersOf({ id: 'm', kind: 'multimeter', config: { ...cfg, mode: 'A' } }).map((m) => m.label)).toEqual(['A']);
    expect(markersOf({ id: 'm', kind: 'multimeter', config: { ...cfg, minus: { pin: 'R3.1' } } }).map((m) => m.label)).toEqual(['+', '−']);
  });

  test('analyser and logic probe flags', () => {
    const a = defaultConfig('analyser') as AnalyserConfig;
    a.channels[2]!.probe = { pin: 'U1.Y' };
    expect(markersOf({ id: 'a', kind: 'analyser', config: a }).map((m) => m.label)).toEqual(['D2']);
    expect(markersOf({ id: 'p', kind: 'logicprobe', config: { probe: { pin: 'U1.Y' } } })).toHaveLength(1);
    expect(markersOf({ id: 'p', kind: 'logicprobe', config: {} })).toEqual([]);
  });

  test('time-based instruments say how much time they span', () => {
    expect(timeSpanOf(scope({ timebase: 2e-3 }))).toBeCloseTo(0.02);
    expect(timeSpanOf({ id: 'a', kind: 'analyser', config: { ...(defaultConfig('analyser') as AnalyserConfig), window: 5e-8 } })).toBe(5e-8);
    expect(timeSpanOf({ id: 'm', kind: 'multimeter', config: {} })).toBeUndefined();
  });
});
