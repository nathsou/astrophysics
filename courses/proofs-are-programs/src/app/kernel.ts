// Shared access to kernel environments for the widgets.
import coreSrc from '@kernel/prelude/core.lean?raw';
import stdSrc from '@kernel/prelude/std.lean?raw';
import { makeEnv, processSource, type ProcessResult, type Message } from '@kernel/frontend.ts';
import type { Environment } from '@kernel/core/env.ts';

export const preludes = [
  { id: 'core', src: coreSrc },
  { id: 'std', src: stdSrc },
];

/** the course's base environment: Lean-style core library plus the course's standard library */
export function baseEnv(): Environment {
  return makeEnv('cic', preludes).env;
}

export interface CheckResult extends ProcessResult {
  warnings: Message[];
  time: number;
}

export function check(src: string, base: Environment = baseEnv()): CheckResult {
  const t0 = performance.now();
  const r = processSource(src, base);
  return { ...r, time: performance.now() - t0 };
}

export { coreSrc, stdSrc };
