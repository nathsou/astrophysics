/**
 * "Use my code": the reader's passing solutions, kept in localStorage and keyed by the pipeline hook they feed
 * (see src/lib/hep/hooks.ts). The Control Room reads them and installs them as hook overrides.
 */
const KEY = 'particle-physics:mine';

export interface Mine {
  /** hook name → { code, enabled } */
  [hook: string]: { code: string; enabled: boolean; exercise: string };
}

export function loadMine(): Mine {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Mine) : {};
  } catch {
    return {};
  }
}

export function saveMine(hook: string, exercise: string, code: string): void {
  try {
    const all = loadMine();
    all[hook] = { code, enabled: all[hook]?.enabled ?? true, exercise };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: the reader's code is simply not remembered */
  }
}

export function setEnabled(hook: string, enabled: boolean): void {
  try {
    const all = loadMine();
    if (all[hook]) all[hook]!.enabled = enabled;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
