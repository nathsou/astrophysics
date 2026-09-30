import { createSignal } from 'solid-js';

interface Progress {
  visited: string[];
  exercises: Record<string, boolean>;
}

function load(): Progress {
  try {
    const v = JSON.parse(localStorage.getItem('pap-progress') ?? 'null');
    if (v && Array.isArray(v.visited)) return { visited: v.visited, exercises: v.exercises ?? {} };
  } catch {
    /* storage unavailable */
  }
  return { visited: [], exercises: {} };
}

const [progress, setProgress] = createSignal<Progress>(load());

function save(p: Progress) {
  setProgress(p);
  try {
    localStorage.setItem('pap-progress', JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function markVisited(slug: string) {
  const p = progress();
  if (!p.visited.includes(slug)) save({ ...p, visited: [...p.visited, slug] });
}

export function markExercise(id: string, done = true) {
  const p = progress();
  if (p.exercises[id] !== done) save({ ...p, exercises: { ...p.exercises, [id]: done } });
}

export const isVisited = (slug: string) => progress().visited.includes(slug);
export const isExerciseDone = (id: string) => !!progress().exercises[id];
export const exerciseCount = (prefix: string) => Object.entries(progress().exercises).filter(([k, v]) => v && k.startsWith(prefix + ':')).length;

export function resetProgress() {
  save({ visited: [], exercises: {} });
}

export { progress };

/** chapters of the CIC course the reader has visited (both courses share the same origin) */
export function cicVisited(slug: string): boolean {
  try {
    const v = JSON.parse(localStorage.getItem('cic-progress') ?? 'null');
    return !!v && Array.isArray(v.visited) && v.visited.includes(slug);
  } catch {
    return false;
  }
}
