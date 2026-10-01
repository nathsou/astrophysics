/**
 * "Use my code" inside a worker: install saved solutions, passed as an argument, as hook overrides.
 *
 * `src/lib/code/apply.ts` reads the entries from `localStorage`, which a worker does not have; this takes them as an argument (the page reads
 * them with `loadMine()` and posts them), but evaluates and installs exactly as that file does.
 */
import { setOverride, activeOverrides } from '../hep/hooks.ts';
import { evaluate, LIBRARY } from '../code/modules.ts';
import type { Mine } from '../code/mine.ts';

export interface AppliedEntries {
  /** The hooks that are now overridden. */
  active: string[];
  /** Hook name → why its code could not be installed. */
  errors: Record<string, string>;
}

/** Remove every override, then evaluate and install each enabled entry. */
export function applyEntries(mine: Mine): AppliedEntries {
  const errors: Record<string, string> = {};
  for (const name of activeOverrides()) setOverride(name, undefined);
  for (const [hookName, m] of Object.entries(mine)) {
    if (!m || !m.enabled) continue;
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
