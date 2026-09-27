import { RiscV } from './riscv';
import { AArch64 } from './aarch64';
import { X86_64 } from './x86_64';
import type { Target, TargetName, TargetOptions } from './target';

export function makeTarget(name: TargetName, opts: TargetOptions = {}): Target {
  switch (name) {
    case 'rv64': return new RiscV(opts);
    case 'aarch64': return new AArch64(opts);
    case 'x86_64': return new X86_64(opts);
    default: throw new Error(`target ${name} not available yet`);
  }
}
