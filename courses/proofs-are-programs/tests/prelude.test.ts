import { describe, expect, it } from 'vitest';
import { baseEnv } from './util.ts';
import { formatMessage } from '@kernel/format.ts';
import stdSrc from '@kernel/prelude/std.lean?raw';

describe('prelude', () => {
  it('core and std check without errors', () => {
    const { env, messages } = baseEnv();
    const out = messages.map((m) => `std.lean:${stdSrc.slice(0, m.span.from).split('\n').length}: ` + formatMessage(env, '', m));
    if (out.length) console.log(out.join('\n'));
    expect(out).toEqual([]);
  });
});
