/**
 * Evaluates the reader's TypeScript as a CommonJS-style module with a controlled `require`.
 * Used in the test worker, in the Control Room worker (for "use my code"), and under Vitest.
 */
import { transform } from 'sucrase';

/**
 * Library modules exercises may import: `hep` (everything) and `hep/<module>` for each directory of
 * src/lib/hep that has an index.ts. New stages register themselves by existing.
 */
const found = import.meta.glob('../hep/*/index.ts', { eager: true }) as Record<string, Record<string, unknown>>;
import * as hepRoot from '../hep/index.ts';

export const LIBRARY: Record<string, unknown> = { hep: hepRoot };
for (const [path, mod] of Object.entries(found)) {
  const name = path.split('/').at(-2)!;
  LIBRARY[`hep/${name}`] = mod;
}

/** Lines added by `new Function` before the module body (for mapping stack traces). */
const FN_HEADER_LINES = 2;

export function transpile(code: string, file: string): string {
  return transform(code, { transforms: ['typescript', 'imports'], filePath: file, production: true }).code;
}

export type Resolver = (specifier: string) => unknown;

export function evaluate(code: string, file: string, resolve: Resolver, consoleImpl: Pick<Console, 'log' | 'warn' | 'error' | 'info'> = console): Record<string, unknown> {
  const js = transpile(code, file);
  const module = { exports: {} as Record<string, unknown> };
  const req = (spec: string) => {
    const m = resolve(spec);
    if (m === undefined) throw new Error(`Cannot find module '${spec}'. Available: ${Object.keys(LIBRARY).join(', ')}`);
    return m;
  };
  const fn = new Function('require', 'module', 'exports', 'console', `${js}\n//# sourceURL=${file}`);
  fn(req, module, module.exports, consoleImpl);
  return module.exports;
}

/** Turn an error into "message (line N)" using the stack, when it points into the reader's code. */
export function describeError(e: unknown, file: string): string {
  if (!(e instanceof Error)) return String(e);
  const m = e.stack && new RegExp(`${file.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}:(\\d+):(\\d+)`).exec(e.stack);
  const where = m ? ` (line ${Number(m[1]) - FN_HEADER_LINES})` : '';
  return `${e.name === 'Error' ? '' : e.name + ': '}${e.message}${where}`;
}
