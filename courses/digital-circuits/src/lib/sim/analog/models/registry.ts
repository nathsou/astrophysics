import type { AnalogModelFactory } from '../device';

interface Entry {
  factory: AnalogModelFactory;
  /** The module that registered it, without any query string (undefined when unknown). */
  owner: string | undefined;
}

/**
 * The table lives on globalThis: a hot reload (Vite HMR) re-evaluates the model modules that changed,
 * and possibly this one, and neither may lose the other's registrations.
 */
const KEY = Symbol.for('digital-circuits.analog.models');
const store = globalThis as unknown as Record<symbol, Map<string, Entry> | undefined>;
const models = (store[KEY] ??= new Map<string, Entry>());

/** The file that called registerAnalogModel, from the stack trace ("…/sources.ts?t=17" → "…/sources.ts"). */
function callerModule(): string | undefined {
  const frame = new Error().stack?.split('\n')[3];
  const m = frame && /(?:\(|\bat )(?:async )?(.*?):\d+:\d+\)?\s*$/.exec(frame);
  return m ? m[1]!.replace(/[?#].*$/, '') : undefined;
}

/**
 * Register the analog behaviour of a catalog type. Each model file calls this at import time.
 *
 * Idempotent: registering a type again from the same module (the module was evaluated twice, as
 * hot reloading does) replaces the entry. Two different modules claiming one type is a bug and
 * throws. `owner` is the registering module; it defaults to the caller and is only passed by tests.
 */
export function registerAnalogModel(type: string, factory: AnalogModelFactory, owner: string | undefined = callerModule()): void {
  const old = models.get(type);
  if (old && old.owner !== undefined && owner !== undefined && old.owner !== owner) {
    throw new Error(`analog: duplicate model for "${type}" (registered by ${old.owner} and by ${owner})`);
  }
  models.set(type, { factory, owner });
}

export function getAnalogModel(type: string): AnalogModelFactory | undefined {
  return models.get(type)?.factory;
}

/** Every type the analog engine can simulate. */
export function analogModelTypes(): string[] {
  return [...models.keys()].sort();
}
