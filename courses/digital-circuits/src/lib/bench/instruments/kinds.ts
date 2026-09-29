/**
 * The instruments the bench can hold: their settings (plain JSON, so they travel in share links and the
 * autosave), defaults, and the probe markers each one puts on the schematic. The panels that draw them
 * are Svelte components (Multimeter.svelte, Scope.svelte, …).
 */
import type { ProbeRef } from './probes';
import { GROUND } from './probes';

export type InstrumentKind = 'multimeter' | 'scope' | 'analyser' | 'logicprobe';

export interface Instrument<C = unknown> {
  id: string;
  kind: InstrumentKind;
  collapsed?: boolean;
  config: C;
}

export interface MultimeterConfig {
  mode: 'V' | 'A' | 'ohm' | 'cont';
  /** Red probe for V, Ω and continuity; black probe defaults to ground for V. */
  plus?: ProbeRef;
  minus?: ProbeRef;
  /** The pin whose current is measured (A). */
  pin?: ProbeRef;
}

export interface ScopeChannel {
  on: boolean;
  probe?: ProbeRef;
  /** Volts per division and vertical position in divisions. */
  vdiv: number;
  pos: number;
}

export interface ScopeConfig {
  /** Seconds per division (ten divisions across). */
  timebase: number;
  channels: ScopeChannel[];
  trigger: { source: number; level: number; slope: 'rise' | 'fall'; mode: 'auto' | 'normal' };
  cursors: { on: boolean; /** screen fractions 0…1 */ t: [number, number]; /** volts */ v: [number, number]; channel: number };
  persistence: boolean;
}

export interface AnalyserChannel {
  probe?: ProbeRef;
  name?: string;
}

export interface AnalyserConfig {
  channels: AnalyserChannel[];
  /** Seconds across the screen. */
  window: number;
  hold: boolean;
  cursors: { on: boolean; t: [number, number] };
  /** Name of a registered protocol decoder (decoders.ts), applied to the first channels. */
  decoder?: string;
}

export interface LogicProbeConfig {
  probe?: ProbeRef;
}

export const KIND_TITLES: Record<InstrumentKind, string> = {
  multimeter: 'Multimeter',
  scope: 'Oscilloscope',
  analyser: 'Logic analyser',
  logicprobe: 'Logic probe',
};

export const KIND_BLURB: Record<InstrumentKind, string> = {
  multimeter: 'Volts, amps, ohms and continuity',
  scope: '4 channels, trigger, cursors',
  analyser: '8 to 16 digital channels',
  logicprobe: 'HIGH, LOW, Z or X of a net',
};

export const MAX_SCOPE_CHANNELS = 4;
export const MAX_ANALYSER_CHANNELS = 16;

export function defaultConfig(kind: InstrumentKind): unknown {
  switch (kind) {
    case 'multimeter':
      return { mode: 'V' } satisfies MultimeterConfig;
    case 'scope':
      return {
        timebase: 1e-3,
        channels: Array.from({ length: MAX_SCOPE_CHANNELS }, (_, i) => ({ on: i < 2, vdiv: 1, pos: 0 })),
        trigger: { source: 0, level: 0.5, slope: 'rise', mode: 'auto' },
        cursors: { on: false, t: [0.3, 0.6], v: [1, 3], channel: 0 },
        persistence: true,
      } satisfies ScopeConfig;
    case 'analyser':
      return {
        channels: Array.from({ length: 8 }, () => ({})),
        window: 1e-3,
        hold: false,
        cursors: { on: false, t: [0.3, 0.6] },
      } satisfies AnalyserConfig;
    case 'logicprobe':
      return {} satisfies LogicProbeConfig;
  }
}

/** Merge saved settings over the defaults, so an old or partial saved instrument still opens. */
export function withDefaultConfig(kind: InstrumentKind, saved: unknown): unknown {
  const base = defaultConfig(kind) as Record<string, unknown>;
  if (!saved || typeof saved !== 'object') return base;
  const out: Record<string, unknown> = { ...base, ...(saved as Record<string, unknown>) };
  if (kind === 'scope') {
    const s = out as unknown as ScopeConfig;
    const dflt = (base as unknown as ScopeConfig).channels;
    s.channels = dflt.map((d, i) => ({ ...d, ...(s.channels?.[i] ?? {}) }));
    s.trigger = { ...(base as unknown as ScopeConfig).trigger, ...s.trigger };
    s.cursors = { ...(base as unknown as ScopeConfig).cursors, ...s.cursors };
  }
  if (kind === 'analyser') {
    const a = out as unknown as AnalyserConfig;
    if (!Array.isArray(a.channels) || a.channels.length < 1) a.channels = (base as unknown as AnalyserConfig).channels;
    a.cursors = { ...(base as unknown as AnalyserConfig).cursors, ...a.cursors };
  }
  return out;
}

export const isKind = (k: unknown): k is InstrumentKind => k === 'multimeter' || k === 'scope' || k === 'analyser' || k === 'logicprobe';

/** Colours of the scope channels and their probe markers: design tokens, resolved where they are drawn. */
export const CHANNEL_TOKENS = ['--series-3', '--series-5', '--series-1', '--series-4'] as const;

export interface Marker {
  ref: ProbeRef;
  label: string;
  /** A CSS custom property name (the colour of the flag). */
  colour: string;
}

/** The probe flags an instrument puts on the schematic. */
export function markersOf(inst: Instrument): Marker[] {
  const out: Marker[] = [];
  const add = (ref: ProbeRef | undefined, label: string, colour: string) => {
    if (ref && !('net' in ref && ref.net === GROUND.net)) out.push({ ref, label, colour });
  };
  switch (inst.kind) {
    case 'multimeter': {
      const c = inst.config as MultimeterConfig;
      if (c.mode === 'A') add(c.pin, 'A', '--copper');
      else {
        add(c.plus, '+', '--sig-x');
        add(c.minus, '−', '--fg');
      }
      break;
    }
    case 'scope':
      (inst.config as ScopeConfig).channels.forEach((ch, i) => ch.on && add(ch.probe, String(i + 1), CHANNEL_TOKENS[i]!));
      break;
    case 'analyser':
      (inst.config as AnalyserConfig).channels.forEach((ch, i) => add(ch.probe, `D${i}`, '--series-6'));
      break;
    case 'logicprobe':
      add((inst.config as LogicProbeConfig).probe, 'LP', '--sig-high');
      break;
  }
  return out;
}

/** The time an instrument spans on screen, if it has one (the bench can set the simulation speed from it). */
export function timeSpanOf(inst: Instrument): number | undefined {
  if (inst.kind === 'scope') return (inst.config as ScopeConfig).timebase * 10;
  if (inst.kind === 'analyser') return (inst.config as AnalyserConfig).window;
  return undefined;
}
