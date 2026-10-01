// Every code snippet in the chapters is checked by the kernel.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { extract } from './snippets.ts';
import { run } from './util.ts';

const dir = join(__dirname, '../src/content/chapters');
const files = readdirSync(dir).filter((f) => f.endsWith('.mdx')).sort();

describe('chapter snippets', () => {
  for (const f of files) {
    const src = readFileSync(join(dir, f), 'utf8');
    const snippets = extract(src);
    if (snippets.length === 0) continue;
    it(f, async () => {
      const failures: string[] = [];
      for (const s of snippets) {
        const r = run(s.code);
        const errs = r.msgs.filter((m) => m.startsWith('error'));
        const sorry = r.msgs.some((m) => m.includes("uses 'sorry'"));
        if (!s.allowErrors && (errs.length > 0 || (s.what.includes('solution') && sorry))) {
          failures.push(`${f}:${s.line} (${s.what}):\n${errs.join('\n')}${sorry ? '\n(uses sorry)' : ''}`);
        }
        // Let Vitest receive worker messages and enforce its timeout between kernel runs.
        await setImmediate();
      }
      if (failures.length) console.log(failures.join('\n\n'));
      expect(failures).toEqual([]);
    });
  }
});
