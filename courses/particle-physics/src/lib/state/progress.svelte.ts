/**
 * Exercise progress and drafts, kept in this browser's localStorage (a per-viewer convenience:
 * everything works without it).
 */
import { browser } from '$app/environment';

const SOLVED_KEY = 'particle-physics:solved';
const DRAFT_KEY = 'particle-physics:drafts';

function read<T>(key: string, fallback: T): T {
  if (!browser) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (!browser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: progress simply is not remembered */
  }
}

class Progress {
  solved: Record<string, number> = $state({});
  private drafts: Record<string, unknown> = {};
  private loaded = false;

  load(): void {
    if (this.loaded || !browser) return;
    this.loaded = true;
    this.solved = read(SOLVED_KEY, {});
    this.drafts = read(DRAFT_KEY, {});
  }

  isSolved(id: string): boolean {
    return id in this.solved;
  }

  markSolved(id: string): void {
    if (this.solved[id]) return;
    this.solved[id] = Date.now();
    write(SOLVED_KEY, this.solved);
  }

  reset(id: string): void {
    delete this.solved[id];
    delete this.drafts[id];
    write(SOLVED_KEY, this.solved);
    write(DRAFT_KEY, this.drafts);
  }

  draft<T>(id: string, fallback: T): T {
    this.load();
    return (this.drafts[id] as T | undefined) ?? fallback;
  }

  saveDraft(id: string, value: unknown): void {
    this.drafts[id] = value;
    write(DRAFT_KEY, this.drafts);
  }

  /** Number of solved exercises whose id starts with the chapter slug. */
  countFor(slug: string): number {
    return Object.keys(this.solved).filter((k) => k.startsWith(`${slug}/`)).length;
  }
}

export const progress = new Progress();
