// Lets Node run the toolchain's TypeScript sources directly (with --experimental-strip-types): the sources import
// each other without file extensions, as bundlers allow, so this hook tries `.ts` and `/index.ts`.
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('.') || specifier.startsWith('/')) && !/\\.[cm]?[jt]s$/.test(specifier) && context.parentURL?.startsWith('file:')) {
    for (const ext of ['.ts', '/index.ts']) {
      const url = new URL(specifier + ext, context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
  }
  return next(specifier, context);
}`),
  import.meta.url,
);
