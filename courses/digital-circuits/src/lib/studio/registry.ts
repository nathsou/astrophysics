/**
 * Chip-view components by device id. A device joins the Studio with an adapter (`adapters/`) and a chip
 * component registered here; the Studio never imports a chip view directly.
 */
import type { Component } from 'svelte';
import type { ChipProps, DeviceFit } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChipComponent = Component<ChipProps<any>>;

const chips = new Map<string, ChipComponent>();

export function registerChip(deviceId: string, component: ChipComponent): void {
  chips.set(deviceId, component);
}

export function getChip(deviceId: string): ChipComponent | undefined {
  return chips.get(deviceId);
}

export type { ChipProps, DeviceFit };
