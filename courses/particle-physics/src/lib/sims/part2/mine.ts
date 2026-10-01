/**
 * "Use my code" for the widgets of Part II: a figure that runs a pipeline function the reader wrote in an exercise can
 * swap it in. Only the named hooks are touched (the Control Room installs all of them together; here a figure installs the
 * ones it uses, and removes them when the toggle goes off).
 */
import { setOverride } from '../../hep/hooks.ts';
import { evaluate, LIBRARY } from '../../code/modules.ts';
import { loadMine } from '../../code/mine.ts';

/** The hooks among `names` for which the reader has a saved, passing solution. */
export function savedFor(names: readonly string[]): string[] {
  const mine = loadMine();
  return names.filter((n) => mine[n]);
}

/** Install (`use` true) or remove (false) the reader's versions of `names`. Returns what is active and any load errors. */
export function useMine(names: readonly string[], use: boolean): { active: string[]; errors: Record<string, string> } {
  const mine = loadMine();
  const active: string[] = [];
  const errors: Record<string, string> = {};
  for (const name of names) {
    const m = mine[name];
    if (!use || !m) {
      setOverride(name, undefined);
      continue;
    }
    try {
      const exports = evaluate(m.code, `mine/${name}.ts`, (s) => LIBRARY[s]);
      const fn = exports[name.split('.').at(-1)!];
      if (typeof fn !== 'function') throw new Error(`the saved code does not export a function named ${name.split('.').at(-1)}`);
      setOverride(name, fn as (...a: never[]) => unknown);
      active.push(name);
    } catch (e) {
      errors[name] = e instanceof Error ? e.message : String(e);
      setOverride(name, undefined);
    }
  }
  return { active, errors };
}
