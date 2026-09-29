/** Helpers on the recovered two-level network: text, signal order. */
import type { Lit, NetOutput, NetTerm, Network } from './types';

export function litText(l: Lit): string {
  return l.neg ? `!${l.signal}` : l.signal;
}

/** A term as text: `A & !B`, `1` for a term with nothing connected, `0` for an off term. */
export function termText(t: NetTerm, and = ' & '): string {
  if (t.kind === 'false') return '0';
  if (t.kind === 'true' || t.lits.length === 0) return '1';
  return t.lits.map(litText).join(and);
}

export function termsOf(net: Network, o: NetOutput): NetTerm[] {
  const byId = new Map(net.terms.map((t) => [t.id, t]));
  return o.terms.map((id) => byId.get(id)).filter((t): t is NetTerm => !!t);
}

/** `Y = A & B | !C`, with `.R`/`.T` marks for registered outputs and `!( … )` for inverted ones. */
export function outputEquation(net: Network, o: NetOutput): string {
  const terms = termsOf(net, o).filter((t) => t.kind !== 'false');
  let sum = terms.length ? terms.map((t) => termText(t)).join(' | ') : '0';
  if (o.invert !== 'none') sum = terms.length > 1 ? `!(${sum})` : `!${sum}`;
  const suffix = o.ff === 'D' ? '.R' : o.ff === 'T' ? '.T' : '';
  return `${o.name}${suffix} = ${sum}`;
}

/** Signals read by some term, in order: inputs first (display order), then output feedbacks. */
export function usedSignals(net: Network, includeClock = false): string[] {
  const used = new Set<string>();
  for (const t of net.terms) for (const l of t.lits) used.add(l.signal);
  const outNames = new Set(net.outputs.map((o) => o.name));
  const ordered: string[] = [];
  for (const i of net.inputs) if (used.has(i) || (includeClock && i === net.clock)) ordered.push(i);
  for (const o of net.outputs) if (used.has(o.name) && !ordered.includes(o.name)) ordered.push(o.name);
  // Anything else (a signal that is neither input nor output) goes last, in name order.
  for (const s of [...used].sort()) if (!ordered.includes(s) && !outNames.has(s)) ordered.push(s);
  return ordered;
}

/** Terms actually used by some output (reachable), preserving network order. */
export function reachableTerms(net: Network): NetTerm[] {
  const used = new Set<string>();
  for (const o of net.outputs) {
    for (const t of o.terms) used.add(t);
    if (o.oe) used.add(o.oe);
  }
  if (net.ar) used.add(net.ar);
  return net.terms.filter((t) => used.has(t.id));
}
