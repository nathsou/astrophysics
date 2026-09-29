import { readFileSync, writeFileSync } from 'node:fs';
import { format } from './format';
import { test } from 'vitest';
const S = '/tmp/claude-0/-home-user-courses/fbe5d748-456c-5840-a4b4-781d5ed9bbae/scratchpad/hdl/';
test('p', () => {
  const src = readFileSync(S + 'fmt1.dcl', 'utf8');
  const f = format(src);
  writeFileSync(S + 'f1.dcl', f);
  writeFileSync(S + 'f2.dcl', format(f));
});
