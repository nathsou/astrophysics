/**
 * The one place where the bench finds the simulation engines.
 *
 * Engines are loaded lazily (only the pages that run a circuit download them). They are looked up
 * with import.meta.glob, so the bench builds even before an engine exists: a missing engine falls
 * back to the stub in ./stub.ts, with a console warning. Expected factories:
 *
 *   src/lib/sim/digital/index.ts   export function createDigitalEngine(flat, options): Engine
 *   src/lib/sim/analog/index.ts    export function createAnalogEngine(flat, options): Engine
 *   src/lib/sim/switch/index.ts    export function createSwitchEngine(flat, options): Engine
 *
 * The switch-level engine is used for 'switch' circuits once it exists; until then they run on the
 * digital engine.
 */
import type { Engine, EngineFactory, EngineOptions } from '../sim/engine';
import type { EngineKind, FlatNetlist } from '../sim/netlist/types';
import { createStubEngine } from './stub';

type Loader = () => Promise<Record<string, unknown>>;

const digital = import.meta.glob('../sim/digital/index.ts') as Record<string, Loader>;
const analog = import.meta.glob('../sim/analog/index.ts') as Record<string, Loader>;
const switchLevel = import.meta.glob('../sim/switch/index.ts') as Record<string, Loader>;

const SOURCES: Record<EngineKind, { modules: Record<string, Loader>; factory: string }[]> = {
  digital: [{ modules: digital, factory: 'createDigitalEngine' }],
  analog: [{ modules: analog, factory: 'createAnalogEngine' }],
  switch: [
    { modules: switchLevel, factory: 'createSwitchEngine' },
    { modules: digital, factory: 'createDigitalEngine' },
  ],
};

const cache = new Map<string, Promise<EngineFactory | undefined>>();

async function load(modules: Record<string, Loader>, name: string): Promise<EngineFactory | undefined> {
  const loader = Object.values(modules)[0];
  if (!loader) return undefined;
  const key = `${Object.keys(modules)[0]}#${name}`;
  let p = cache.get(key);
  if (!p) {
    p = loader().then(
      (m) => (typeof m[name] === 'function' ? (m[name] as EngineFactory) : undefined),
      (e: unknown) => {
        console.error(`bench: could not load ${key}`, e);
        return undefined;
      },
    );
    cache.set(key, p);
  }
  return p;
}

/** Which engine will actually run a circuit of this kind ('stub' when none is available yet). */
export async function engineAvailable(kind: EngineKind): Promise<EngineKind | 'stub'> {
  for (const s of SOURCES[kind]) if (await load(s.modules, s.factory)) return s.factory === 'createDigitalEngine' ? 'digital' : kind;
  return 'stub';
}

/**
 * Create an engine for a flattened circuit. `kind` defaults to digital. Falls back to the stub
 * engine when the real one is not there (development only; the stub is not a simulator).
 */
export async function createEngine(kind: EngineKind | undefined, flat: FlatNetlist, options?: EngineOptions): Promise<Engine> {
  const k: EngineKind = kind ?? 'digital';
  for (const s of SOURCES[k]) {
    const factory = await load(s.modules, s.factory);
    if (factory) return factory(flat, options);
  }
  console.warn(`bench: no ${k} engine yet; using the stub engine`);
  return createStubEngine(flat, { ...options, kind: k === 'analog' ? 'analog' : 'digital' });
}
