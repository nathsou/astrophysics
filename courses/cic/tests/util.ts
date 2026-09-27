import coreSrc from '../src/kernel/prelude/core.lean?raw';
import { makeEnv, processSource } from '../src/kernel/frontend.ts';
import { formatMessage } from '../src/kernel/format.ts';
import type { CalculusId } from '../src/kernel/core/calculus.ts';

export function run(src: string, calculus: CalculusId = 'cic', prelude = true) {
  const { env } = makeEnv(calculus, prelude && calculus === 'cic' ? [{ id: 'core', src: coreSrc }] : []);
  const r = processSource(src, env);
  const msgs = r.messages.map((m) => formatMessage(r.env, src, m));
  return { ...r, msgs, errors: msgs.filter((m) => m.startsWith('error')) };
}
export { coreSrc };
