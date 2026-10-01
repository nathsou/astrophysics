/**
 * Install the reader's saved solutions ("use my code") as hook overrides.
 *
 * Each saved solution is keyed by the hook it feeds, `<module>.<function>`. The solution's exports must include a
 * function with that final name; `applyMine` evaluates the code and installs it with `setOverride`.
 */
import { setOverride, activeOverrides } from '../hep/hooks';
import { evaluate, LIBRARY } from './modules';
import { loadMine } from './mine';

export interface Applied {
  active: string[];
  errors: Record<string, string>;
}

/** Evaluate every enabled saved solution and install it. Clears overrides that are no longer enabled. */
export function applyMine(): Applied {
  const mine = loadMine();
  const errors: Record<string, string> = {};
  for (const name of activeOverrides()) setOverride(name, undefined);
  for (const [hookName, m] of Object.entries(mine)) {
    if (!m.enabled) continue;
    try {
      const exports = evaluate(m.code, `mine/${hookName}.ts`, (s) => LIBRARY[s]);
      const fnName = hookName.split('.').at(-1)!;
      const fn = exports[fnName];
      if (typeof fn !== 'function') throw new Error(`the saved code does not export a function named ${fnName}`);
      setOverride(hookName, fn as (...a: never[]) => unknown);
    } catch (e) {
      errors[hookName] = e instanceof Error ? e.message : String(e);
    }
  }
  return { active: activeOverrides(), errors };
}

/** Which saved solutions exist, and whether each is enabled (for the Control Room's panel). */
export function listMine(): { hook: string; exercise: string; enabled: boolean }[] {
  return Object.entries(loadMine()).map(([hook, m]) => ({ hook, exercise: m.exercise, enabled: m.enabled }));
}
