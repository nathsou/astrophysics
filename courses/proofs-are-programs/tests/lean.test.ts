// Regression tests for the language: every file in tests/lean must check without errors,
// except for the lines marked `-- expect-error`.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { run } from './util.ts';

const dir = join(__dirname, 'lean');

describe('language regression files', () => {
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.lean')).sort()) {
    it(f, () => {
      const src = readFileSync(join(dir, f), 'utf8');
      const lines = src.split('\n');
      const r = run(src);
      const unexpected = r.messages.filter((m) => {
        if (m.severity !== 'error') return false;
        const line = src.slice(0, m.span.from).split('\n').length;
        // the error may be reported on the command's first line: look at the whole command
        const cmd = r.results.find((c) => c.span.from <= m.span.from && m.span.from <= c.span.to);
        const first = cmd ? src.slice(0, cmd.span.from).split('\n').length : line;
        const last = cmd ? src.slice(0, cmd.span.to).split('\n').length : line;
        return !lines.slice(first - 1, last).some((l) => l.includes('-- expect-error'));
      });
      if (unexpected.length) console.log(unexpected.map((m) => r.msgs[r.messages.indexOf(m)]).join('\n'));
      expect(unexpected.length).toBe(0);
    });
  }
});
