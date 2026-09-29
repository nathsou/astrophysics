import { describe, expect, it } from 'vitest';
import { baseEnv } from './util.ts';
import { formatMessage } from '@kernel/format.ts';

describe('prelude', () => {
  it('core and std check without errors', () => {
    const { env, messages } = baseEnv();
    const out = messages.map((m) => formatMessage(env, '', m));
    if (out.length) console.log(out.join('\n'));
    expect(out).toEqual([]);
  });
});
