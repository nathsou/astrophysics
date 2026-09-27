/**
 * Evaluates learner TypeScript as a CommonJS-style module with a controlled `require`.
 * Used both inside the test worker and (for "use my implementation") on the main thread.
 */
import { transform } from 'sucrase';
import * as core from '@lm/core';
import * as coreText from '@lm/core/text';
import * as coreTokenise from '@lm/core/tokenise';
import * as coreNgram from '@lm/core/ngram';
import * as coreLm from '@lm/core/lm';
import * as coreRandom from '@lm/core/random';
import * as coreTensor from '@lm/core/tensor';
import * as coreGpu from '@lm/core/gpu';
import * as coreSample from '@lm/core/sample';

/** Library modules exercises may import. Grows as the course adds modules to @lm/core. */
export const LIBRARY: Record<string, unknown> = {
  '@lm/core': core,
  '@lm/core/text': coreText,
  '@lm/core/tokenise': coreTokenise,
  '@lm/core/ngram': coreNgram,
  '@lm/core/lm': coreLm,
  '@lm/core/random': coreRandom,
  '@lm/core/tensor': coreTensor,
  '@lm/core/gpu': coreGpu,
  '@lm/core/sample': coreSample,
};

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

/** Turn an error into "message (file line N)" using the stack, when it points into learner code. */
export function describeError(e: unknown, file: string): string {
  if (!(e instanceof Error)) return String(e);
  const m = e.stack && new RegExp(`${file.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}:(\\d+):(\\d+)`).exec(e.stack);
  const where = m ? ` (line ${Number(m[1]) - FN_HEADER_LINES})` : '';
  return `${e.name === 'Error' ? '' : e.name + ': '}${e.message}${where}`;
}
