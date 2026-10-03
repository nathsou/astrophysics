/**
 * What the learner has done: lessons visited and completed, exercise results, a daily streak.
 * Exercise results say what was established ("answered correctly", "attempted"), never more.
 */
import { browser } from '$app/environment';
import { readJSON, today, writeJSON } from './storage';

export interface ExerciseResult {
  /** Solved correctly at least once. */
  ok: boolean;
  tries: number;
  at: number;
}

export interface ProgressData {
  visited: Record<string, number>;
  completed: Record<string, number>;
  exercises: Record<string, ExerciseResult>;
  /** Days on which the learner did something, for the streak. */
  days: string[];
  /** Best scores in the practice games, by game id. */
  best: Record<string, number>;
}

const KEY = 'mandarin:progress';
const EMPTY: ProgressData = { visited: {}, completed: {}, exercises: {}, days: [], best: {} };

class Progress {
  data: ProgressData = $state(structuredClone(EMPTY));
  private loaded = false;

  load(): void {
    if (this.loaded || !browser) return;
    this.loaded = true;
    this.data = readJSON(KEY, structuredClone(EMPTY));
    addEventListener('storage', (e) => {
      if (e.key === KEY) this.data = readJSON(KEY, structuredClone(EMPTY));
    });
  }

  private save(): void {
    const d = today();
    if (this.data.days[this.data.days.length - 1] !== d) this.data.days = [...this.data.days.slice(-400), d];
    writeJSON(KEY, this.data);
  }

  /** Count today towards the streak. */
  touch(): void {
    this.save();
  }

  visit(slug: string): void {
    this.data.visited[slug] = Date.now();
    this.save();
  }

  complete(slug: string): void {
    this.data.completed[slug] = Date.now();
    this.save();
  }

  uncomplete(slug: string): void {
    delete this.data.completed[slug];
    this.save();
  }

  record(id: string, ok: boolean): void {
    const prev = this.data.exercises[id];
    this.data.exercises[id] = { ok: ok || !!prev?.ok, tries: (prev?.tries ?? 0) + 1, at: Date.now() };
    this.save();
  }

  setBest(game: string, score: number): boolean {
    if ((this.data.best[game] ?? -Infinity) >= score) return false;
    this.data.best[game] = score;
    this.save();
    return true;
  }

  /** Consecutive days with activity, ending today or yesterday. */
  get streak(): number {
    const days = new Set(this.data.days);
    const d = new Date();
    if (!days.has(today(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days.has(today(d))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  replace(data: ProgressData): void {
    this.data = { ...structuredClone(EMPTY), ...data };
    writeJSON(KEY, this.data);
  }
}

export const progress = new Progress();
