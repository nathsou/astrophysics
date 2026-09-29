import type { AnalogModelFactory } from '../device';

const models = new Map<string, AnalogModelFactory>();

/** Register the analog behaviour of a catalog type. Each model file calls this at import time. */
export function registerAnalogModel(type: string, factory: AnalogModelFactory): void {
  if (models.has(type)) throw new Error(`analog: duplicate model for "${type}"`);
  models.set(type, factory);
}

export function getAnalogModel(type: string): AnalogModelFactory | undefined {
  return models.get(type);
}

/** Every type the analog engine can simulate. */
export function analogModelTypes(): string[] {
  return [...models.keys()].sort();
}
