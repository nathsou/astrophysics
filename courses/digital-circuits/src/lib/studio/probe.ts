/**
 * Cross-probing: how a selection expands into everything related to it.
 *
 * An adapter describes its device once as a {@link ProbeSpec} (which terms feed which outputs, which
 * configuration bits belong to a term or to an output's macrocell, where each output is written in
 * the source) and gets `resolve(ref)` for free. The rules:
 *
 *   output   → the output, all its terms, their bits and the macrocell's own bits, its source line
 *   term     → the term, the outputs it feeds, its bits, the signals it reads, their source lines
 *   signal   → an output signal acts as the output; an input selects the terms that read it
 *   bit      → the owner of the bit (a term or an output), plus the bit itself
 *   line     → the outputs defined on that source line
 */
import { EMPTY_PROBE, type Probe, type Ref } from './types';

export interface ProbeTermSpec {
  id: string;
  /** Outputs whose OR the term feeds (more than one for a shared PLA term). */
  outputs: string[];
  /** The configuration bits that define the term (its row in the AND array, its enable bit). */
  bits: number[];
  /** The bits to show when the term is reached through one of its outputs (default: `bits`). */
  bitsVia?: (output: string) => number[];
  /** Signals the term reads. */
  signals: string[];
}

export interface ProbeSpec {
  outputs: string[];
  /** Source line of each output. */
  outputLine: Record<string, number>;
  terms: ProbeTermSpec[];
  /** Bits of the output's own configuration (polarity, register, output enable, steering). */
  outputBits: Record<string, number[]>;
  /** The owner of a bit, for clicking in the bits view. */
  bitOwner(index: number): { term?: string; output?: string } | undefined;
}

class Builder {
  outputs = new Set<string>();
  terms = new Set<string>();
  signals = new Set<string>();
  bits = new Set<number>();
  lines = new Set<number>();
  build(): Probe {
    return { outputs: this.outputs, terms: this.terms, signals: this.signals, bits: this.bits, lines: this.lines };
  }
}

export function makeResolver(spec: ProbeSpec): (ref: Ref) => Probe {
  const termById = new Map(spec.terms.map((t) => [t.id, t]));
  const termsOf = new Map<string, ProbeTermSpec[]>();
  for (const t of spec.terms) for (const o of t.outputs) (termsOf.get(o) ?? termsOf.set(o, []).get(o)!).push(t);
  const outputNames = new Set(spec.outputs);

  const addOutput = (b: Builder, name: string, withTerms: boolean) => {
    b.outputs.add(name);
    b.signals.add(name);
    const line = spec.outputLine[name];
    if (line) b.lines.add(line);
    for (const bit of spec.outputBits[name] ?? []) b.bits.add(bit);
    if (withTerms) for (const t of termsOf.get(name) ?? []) addTerm(b, t, false, name);
  };
  const addTerm = (b: Builder, t: ProbeTermSpec, withOutputs: boolean, via?: string) => {
    b.terms.add(t.id);
    for (const bit of via !== undefined && t.bitsVia ? t.bitsVia(via) : t.bits) b.bits.add(bit);
    for (const s of t.signals) b.signals.add(s);
    if (withOutputs) for (const o of t.outputs) addOutput(b, o, false);
  };

  return (ref: Ref): Probe => {
    const b = new Builder();
    switch (ref.kind) {
      case 'output':
        if (outputNames.has(ref.name)) addOutput(b, ref.name, true);
        break;
      case 'term': {
        const t = termById.get(ref.id);
        if (t) addTerm(b, t, true);
        break;
      }
      case 'signal':
        if (outputNames.has(ref.name)) addOutput(b, ref.name, true);
        else {
          b.signals.add(ref.name);
          for (const t of spec.terms) if (t.signals.includes(ref.name)) b.terms.add(t.id);
        }
        break;
      case 'bit': {
        const owner = spec.bitOwner(ref.index);
        if (owner?.term) {
          const t = termById.get(owner.term);
          if (t) addTerm(b, t, true);
        } else if (owner?.output) addOutput(b, owner.output, false);
        b.bits.add(ref.index);
        break;
      }
      case 'line':
        for (const name of spec.outputs) if (spec.outputLine[name] === ref.line) addOutput(b, name, true);
        b.lines.add(ref.line);
        break;
    }
    return b.outputs.size + b.terms.size + b.signals.size + b.bits.size + b.lines.size === 0 ? EMPTY_PROBE : b.build();
  };
}
