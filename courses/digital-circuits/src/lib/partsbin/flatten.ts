import type { Circuit, FlatNetlist } from '../sim/netlist/types';
import type { SubResolver } from '../sim/netlist/connect';
import { flatten } from '../sim/netlist/flatten';
import { partsResolver } from './store-core';
import { partsBin } from './store.svelte';

/**
 * The resolver for `part:<id>` components in chapter circuits: the reader's parts when they have chosen
 * "use my parts" (and have built them), the reference parts otherwise. Renderers pass it as `parts`.
 */
export const defaultParts: SubResolver = (type) => partsBin.resolver()(type);

/** Flatten a circuit that may contain `part:<id>` components. */
export function flattenWithParts(circuit: Circuit, usingMine = partsBin.useMine): FlatNetlist {
  return flatten(circuit, partsResolver(usingMine, (id) => partsBin.mine[id]));
}
