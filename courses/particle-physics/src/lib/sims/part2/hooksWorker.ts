/**
 * Shared by the Part II workers: install the reader's saved functions (their source, sent by the page) as hook overrides inside
 * the worker, and remove any that are not sent. The worker has its own copy of `hep`, so this never touches the page's.
 */
import { setOverride } from '../../hep/hooks.ts';
import { evaluate, LIBRARY } from '../../code/modules.ts';

export function installHooks(names: readonly string[], mine: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const name of names) {
    const code = mine[name];
    if (!code) {
      setOverride(name, undefined);
      continue;
    }
    try {
      const exports = evaluate(code, `mine/${name}.ts`, (s) => LIBRARY[s]);
      const fn = exports[name.split('.').at(-1)!];
      if (typeof fn !== 'function') throw new Error(`the saved code does not export a function named ${name.split('.').at(-1)}`);
      setOverride(name, fn as (...a: never[]) => unknown);
    } catch (e) {
      errors[name] = e instanceof Error ? e.message : String(e);
      setOverride(name, undefined);
    }
  }
  return errors;
}
