/**
 * Exercise progress and drafts, kept in this browser's localStorage (a per-viewer convenience:
 * everything works without it).
 */
import { browser } from '$app/environment';

const SOLVED_KEY = 'formal-verification:solved';
const DRAFT_KEY = 'formal-verification:drafts';
const CAUGHT_KEY = 'formal-verification:caught';
const VISITED_KEY = 'formal-verification:visited';

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
  /** Bug-museum exhibits the reader has caught with the course's tools (exhibit id → time). */
  caught: Record<string, number> = $state({});
  /** Chapters the reader has opened (slug → time). */
  visited: Record<string, number> = $state({});
  private drafts: Record<string, unknown> = {};
  private loaded = false;

  load(): void {
    if (this.loaded || !browser) return;
    this.loaded = true;
    this.solved = read(SOLVED_KEY, {});
    this.drafts = read(DRAFT_KEY, {});
    this.caught = read(CAUGHT_KEY, {});
    this.visited = read(VISITED_KEY, {});
  }

  /** Record that the reader caught a museum exhibit (called by the exercise that re-enacts it). */
  markCaught(exhibit: string): void {
    this.load();
    if (this.caught[exhibit]) return;
    this.caught[exhibit] = Date.now();
    write(CAUGHT_KEY, this.caught);
  }

  isCaught(exhibit: string): boolean {
    return exhibit in this.caught;
  }

  markVisited(slug: string): void {
    this.load();
    if (this.visited[slug]) return;
    this.visited[slug] = Date.now();
    write(VISITED_KEY, this.visited);
  }

  /** Everything this browser remembers, as JSON (for moving progress to another browser). */
  exportJson(): string {
    this.load();
    return JSON.stringify({ version: 1, solved: this.solved, drafts: this.drafts, caught: this.caught, visited: this.visited }, null, 2);
  }

  importJson(text: string): void {
    const data = JSON.parse(text) as { solved?: Record<string, number>; drafts?: Record<string, unknown>; caught?: Record<string, number>; visited?: Record<string, number> };
    this.solved = { ...this.solved, ...(data.solved ?? {}) };
    this.drafts = { ...this.drafts, ...(data.drafts ?? {}) };
    this.caught = { ...this.caught, ...(data.caught ?? {}) };
    this.visited = { ...this.visited, ...(data.visited ?? {}) };
    write(SOLVED_KEY, this.solved);
    write(DRAFT_KEY, this.drafts);
    write(CAUGHT_KEY, this.caught);
    write(VISITED_KEY, this.visited);
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
