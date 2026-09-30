import coreSrc from '@kernel/prelude/core.lean?raw';
import stdSrc from '@kernel/prelude/std.lean?raw';
import { makeEnv, processSource } from '@kernel/frontend.ts';
import { formatMessage } from '@kernel/format.ts';

export const preludes = [
  { id: 'core', src: coreSrc },
  { id: 'std', src: stdSrc },
];

export function baseEnv() {
  return makeEnv('cic', preludes);
}

export function run(src: string, strict = true) {
  const { env, messages } = baseEnv();
  if (strict && messages.length) throw new Error('prelude errors:\n' + messages.map((m) => formatMessage(env, '', m)).join('\n'));
  const r = processSource(src, env);
  const msgs = r.messages.map((m) => formatMessage(r.env, src, m));
  return { ...r, msgs, errors: msgs.filter((m) => m.startsWith('error')) };
}
