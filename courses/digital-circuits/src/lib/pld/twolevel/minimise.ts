/**
 * The minimiser used by the fitters: exact Quine–McCluskey when the function depends on few
 * variables, Espresso otherwise, with the choice of output polarity that PAL and GAL macrocells
 * (and the PLA's output inverters) make possible.
 */
import {
  compareCost,
  coverCost,
  coverMinterms,
  embedCubes,
  projectCubes,
  supportOf,
  type Cover,
} from './cube';
import { espresso, type EspressoOptions } from './espresso';
import { quineMcCluskey } from './qm';
import { complement } from './unate';

export interface MinimiseOptions {
  /** 'exact' (Quine–McCluskey), 'heuristic' (Espresso) or 'auto' (default). */
  method?: 'auto' | 'exact' | 'heuristic';
  /** In 'auto', use the exact method when the function depends on at most this many variables (default 8). */
  exactMaxVars?: number;
  espresso?: EspressoOptions;
}

/**
 * Minimise a single-output function: a cover of the on-set, with optional don't cares. Only the
 * variables the function depends on take part, so a function of 3 of 22 signals is minimised
 * exactly.
 */
export function minimise(on: Cover, dc?: Cover, opts: MinimiseOptions = {}): Cover {
  const n = on.n;
  if (on.cubes.length === 0) return { n, cubes: [] };
  const dcCubes = dc?.cubes ?? [];
  const support = supportOf(n, on.cubes, dcCubes);
  const k = support.length;
  const pOn: Cover = { n: k, cubes: projectCubes(on.cubes, support) };
  const pDc: Cover = { n: k, cubes: projectCubes(dcCubes, support) };
  const method = opts.method ?? 'auto';
  const exact = method === 'exact' || (method === 'auto' && k <= (opts.exactMaxVars ?? 8));
  let result: Cover;
  if (exact) {
    const onMs = coverMinterms(pOn);
    const dcMs = coverMinterms(pDc);
    const q = quineMcCluskey(k, onMs, dcMs, { traceLimit: 0 });
    result = q.cover;
    if (!q.exact) {
      // The covering step ran out of budget: let Espresso have a go as well.
      const e = espresso(pOn, pDc, opts.espresso);
      if (compareCost(coverCost(e), coverCost(result)) < 0) result = e;
    }
  } else {
    result = espresso(pOn, pDc, opts.espresso);
  }
  return { n, cubes: embedCubes(result.cubes, support, n) };
}

export type Polarity = 'high' | 'low';

export interface PolarityChoice {
  /** 'high': the cover is the function; 'low': the cover is its complement. */
  polarity: Polarity;
  cover: Cover;
  high: Cover;
  low: Cover;
}

/**
 * Minimise the function and its complement (sharing the don't cares) and keep the cheaper: fewer
 * product terms, then fewer literals; active high on a tie.
 */
export function choosePolarity(on: Cover, dc?: Cover, opts: MinimiseOptions = {}): PolarityChoice {
  const high = minimise(on, dc, opts);
  const low = minimiseComplement(on, dc, opts);
  const polarity: Polarity = compareCost(coverCost(low), coverCost(high)) < 0 ? 'low' : 'high';
  return { polarity, cover: polarity === 'high' ? high : low, high, low };
}

/** Minimise the complement of a function: its off-set, with the same don't cares. */
export function minimiseComplement(on: Cover, dc?: Cover, opts: MinimiseOptions = {}): Cover {
  const n = on.n;
  const off: Cover = { n, cubes: complement([...on.cubes, ...(dc?.cubes ?? [])], n) };
  return minimise(off, dc, opts);
}
