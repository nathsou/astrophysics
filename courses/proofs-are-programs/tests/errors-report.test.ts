// Opt-in report of the messages produced by the playgrounds marked `errors` (to review them by eye):
//   REPORT=02 npx vitest run tests/errors-report.test.ts
import { it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extract } from './content.test.ts';
import { run } from './util.ts';

it.skipIf(!process.env.REPORT)('errors report', () => {
  const dir = join(__dirname, '../src/content/chapters');
  for (const f of readdirSync(dir).filter((x) => x.startsWith(process.env.REPORT!))) {
    for (const s of extract(readFileSync(join(dir, f), 'utf8'))) {
      if (!s.allowErrors || s.what === 'Exercise') continue;
      const r = run(s.code);
      console.log(`--- ${f}:${s.line} (${s.what})\n${r.msgs.filter((m) => !m.startsWith('info')).join('\n')}`);
    }
  }
});
