import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { runTests } from '../../code/run';
const d = '/tmp/claude-0/-home-user-courses/089620dd-e749-5680-aba9-29b164475049/scratchpad/ex/';
test('ex5', async () => {
  const good = await runTests('ex5', readFileSync(d + 'ex5-solution.ts', 'utf8'), readFileSync(d + 'ex5-tests.ts', 'utf8'));
  console.log(good.error, good.results.map((r) => `${r.passed ? 'ok' : 'FAIL'} ${r.name} ${r.error ?? ''}`).join('\n'));
  expect(good.results.every((r) => r.passed)).toBe(true);
});
