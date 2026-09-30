import type { Circuit } from '../sim/netlist/types';
import type { SubResolver } from '../sim/netlist/connect';
import { costOf, type Cost } from '../sim/check';

export function costOfSafe(c: Circuit, parts?: SubResolver): Cost | undefined {
  try {
    return costOf(c, parts);
  } catch {
    return undefined;
  }
}
