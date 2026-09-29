// Shared access to kernel environments for the widgets.
import coreSrc from '@kernel/prelude/core.lean?raw';
import { makeEnv, processSource, type ProcessResult, type Message } from '@kernel/frontend.ts';
import type { CalculusId } from '@kernel/core/calculus.ts';
import type { Environment } from '@kernel/core/env.ts';

export type PreludeId = 'core' | 'none';

export function envFor(calculus: CalculusId, prelude: PreludeId = calculus === 'cic' || calculus === 'typeInType' ? 'core' : 'none'): Environment {
  const pre = prelude === 'core' ? [{ id: 'core', src: coreSrc }] : [];
  return makeEnv(calculus, pre).env;
}

export interface CheckResult extends ProcessResult {
  warnings: Message[];
  time: number;
}

export function check(src: string, base: Environment): CheckResult {
  const t0 = performance.now();
  const r = processSource(src, base);
  return { ...r, time: performance.now() - t0 };
}

export { coreSrc };
