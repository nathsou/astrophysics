/** The example circuits in src/lib/bench/examples/*.json, for the bench's Open example menu. */
import type { Circuit } from '../../sim/netlist/types';

export interface Example {
  key: string;
  title: string;
  engine: string;
  circuit: Circuit;
}

const files = import.meta.glob<Circuit>('../examples/*.json', { eager: true, import: 'default' });

/** Every example, sorted by title. */
export const EXAMPLES: Example[] = Object.entries(files)
  .map(([path, circuit]) => {
    const key = path.replace(/^.*\//, '').replace(/\.json$/, '');
    return { key, title: circuit.title ?? key, engine: circuit.engine ?? 'digital', circuit };
  })
  .sort((a, b) => a.title.localeCompare(b.title));
