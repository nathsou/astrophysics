/**
 * The reader's parts bin as reactive state, kept in localStorage (`dc-parts`). Storage is a per-browser
 * convenience: everything works without it, and export/import moves a bin between browsers.
 */
import { browser } from '$app/environment';
import type { Circuit } from '../sim/netlist/types';
import { PartsStoreCore, type MinePart } from './store-core';
import { partsResolver } from './store-core';

class PartsBin {
  private readonly core = new PartsStoreCore(browser ? safeStorage() : undefined);
  private version = $state(0);
  private loaded = false;

  private touch(): void {
    this.version++;
  }

  /** Read localStorage once, on first use. It changes no state that anything has read yet, so it is safe inside a render. */
  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.core.load();
  }

  get mine(): Record<string, MinePart> {
    this.load();
    void this.version;
    return this.core.mine;
  }
  get useMine(): boolean {
    this.load();
    void this.version;
    return this.core.useMine;
  }
  set useMine(on: boolean) {
    this.load();
    this.core.setUseMine(on);
    this.touch();
  }
  has(id: string): boolean {
    this.load();
    void this.version;
    return this.core.has(id);
  }
  set(id: string, circuit: Circuit, extra: Partial<MinePart> = {}): void {
    this.load();
    this.core.set(id, circuit, extra);
    this.touch();
  }
  remove(id: string): void {
    this.load();
    this.core.remove(id);
    this.touch();
  }
  exportJson(): string {
    return this.core.exportJson();
  }
  importJson(text: string, options?: { verify?: boolean; merge?: boolean }) {
    this.load();
    const r = this.core.importJson(text, options);
    this.touch();
    return r;
  }
  resolver(usingMine = this.useMine) {
    this.load();
    void this.version;
    return partsResolver(usingMine, (id) => this.core.mine[id]);
  }
}

function safeStorage(): Storage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

export const partsBin = new PartsBin();
