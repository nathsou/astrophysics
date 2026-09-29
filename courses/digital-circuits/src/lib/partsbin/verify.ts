/** Running a part's checker on a circuit (the reference, or the reader's attempt). */
import type { Circuit } from '../sim/netlist/types';
import type { SubResolver } from '../sim/netlist/connect';
import { checkCombinational, checkSequential, type CombResult, type Cost, type SeqResult } from '../sim/check';
import { costOfSafe } from './cost';
import { discover } from '../sim/check/circuit';
import { behaviourOf, getPart, referenceOf } from './parts';
import type { PartSpec } from './types';

export interface PartResult {
  pass: boolean;
  problems: string[];
  comb?: CombResult;
  seq?: SeqResult;
  cost?: Cost;
}

/** The ports of a circuit as pins, in the order a block symbol shows them. */
export function portsOf(circuit: Circuit): { inputs: string[]; outputs: string[] } {
  const ports = circuit.components.filter((c) => c.type === 'port');
  const order = (a: { y: number; x: number }, b: { y: number; x: number }) => a.y - b.y || a.x - b.x;
  const name = (p: (typeof ports)[number]) => String(p.params?.name ?? p.id);
  return {
    inputs: ports.filter((p) => (p.params?.dir ?? 'in') !== 'out').sort(order).map(name),
    outputs: ports.filter((p) => p.params?.dir === 'out').sort(order).map(name),
  };
}

/**
 * Check `circuit` against the part's spec. The circuit's pins must be exactly the part's (ports named as
 * the pins; toggles and indicators with those names also work for the checker, but only ports make a part).
 */
export function checkPart(part: PartSpec | string, circuit?: Circuit, parts?: SubResolver, options: { maxFailures?: number } = {}): PartResult {
  const spec = typeof part === 'string' ? getPart(part) : part;
  if (!spec) return { pass: false, problems: [`Unknown part ${String(part)}.`] };
  if (!spec.check) return { pass: false, problems: [`${spec.name} is planned: it has no checker yet.`] };
  const c = circuit ?? referenceOf(spec.id);
  if (!c) return { pass: false, problems: [`${spec.name} has no reference circuit.`] };
  const problems: string[] = [];
  const found = portsOf(c);
  const want = { inputs: spec.pins.filter((p) => p.dir === 'in').map((p) => p.name), outputs: spec.pins.filter((p) => p.dir === 'out').map((p) => p.name) };
  const missing = [...want.inputs.filter((n) => !found.inputs.includes(n)).map((n) => `input ${n}`), ...want.outputs.filter((n) => !found.outputs.includes(n)).map((n) => `output ${n}`)];
  if (missing.length) problems.push(`The circuit needs ports for ${missing.join(', ')}.`);
  const extra = [...found.inputs.filter((n) => !want.inputs.includes(n)), ...found.outputs.filter((n) => !want.outputs.includes(n))];
  if (extra.length) problems.push(`The circuit has ports that are not pins of ${spec.name}: ${extra.join(', ')}.`);
  if (problems.length) return { pass: false, problems };
  const engine = c.engine ?? spec.engine ?? 'digital';
  const resolver = parts;
  if (spec.check.kind === 'comb') {
    const r = checkCombinational(c, spec.check.spec, { ...spec.check.options, engine, parts: resolver, ...options });
    return { pass: r.pass, problems: r.problems, comb: r, cost: costOfSafe(c, resolver) };
  }
  const r = checkSequential(c, spec.check.spec, { parts: resolver });
  return { pass: r.pass, problems: r.problems, seq: r, cost: costOfSafe(c, resolver) };
}

/** The pins a reader's circuit exposes, for display next to a part card. */
export { discover, behaviourOf };
