/** The device adapters, by id. A new device (the vFPGA) adds its adapter here or registers it at run time. */
import type { DeviceAdapter } from '../types';
import { promAdapter } from './prom';
import { plaAdapter } from './pla';
import { galAdapter } from './gal';
import { cpldAdapter } from './cpld';

export { promAdapter, plaAdapter, galAdapter, cpldAdapter };

const adapters = new Map<string, DeviceAdapter>();

export function registerAdapter(a: DeviceAdapter): void {
  adapters.set(a.id, a);
}

for (const a of [promAdapter, plaAdapter, galAdapter, cpldAdapter]) registerAdapter(a);

export function getAdapter(id: string): DeviceAdapter | undefined {
  return adapters.get(id);
}

export function listAdapters(): DeviceAdapter[] {
  return [...adapters.values()];
}
