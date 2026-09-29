// A standalone derivation tree for a term, optionally revealed step by step.

import { Show, createMemo, createSignal } from 'solid-js';
import { envFor, check } from '../app/kernel.ts';
import type { CalculusId } from '@kernel/core/calculus.ts';
import { TypeChecker, type Deriv } from '@kernel/core/typechecker.ts';
import { DerivationTree } from './DerivationTree.tsx';
import { formatMsg } from '@kernel/format.ts';

export interface DerivationViewProps {
  term: string;
  setup?: string;
  calculus?: string;
  stepwise?: boolean | string;
  hideFormation?: boolean | string;
  editable?: boolean | string;
  title?: string;
}

const bool = (v: boolean | string | undefined, d: boolean) => (v === undefined ? d : v === true || v === 'true');

export function DerivationView(props: DerivationViewProps) {
  const [term, setTerm] = createSignal(props.term);
  const res = createMemo(() => {
    const env = envFor((props.calculus as CalculusId) ?? 'cic');
    const src = `${props.setup ?? ''}\n#check ${term()}`;
    const r = check(src, env);
    const last = r.results[r.results.length - 1];
    const o = last?.output;
    let deriv: Deriv | undefined;
    let error: string | undefined;
    const err = r.messages.find((m) => m.severity === 'error');
    if (o?.k === 'check') {
      try {
        deriv = new TypeChecker(r.env, o.lctx, { derive: true, fuel: 100_000 }).inferDeriv(o.expr).deriv;
      } catch (e) {
        deriv = (e as { deriv?: Deriv }).deriv;
        error = (e as Error).message;
      }
    }
    if (err) {
      error = formatMsg(r.env, err.msg);
      // try to get a partial derivation of the failing term
      if (!deriv && last?.messages.length) {
        const m = last.messages[0].msg.find((p) => typeof p !== 'string');
        if (m && typeof m !== 'string') {
          try {
            new TypeChecker(r.env, m.lctx, { derive: true }).inferDeriv(m.e);
          } catch (e2) {
            deriv = (e2 as { deriv?: Deriv }).deriv;
          }
        }
      }
    }
    return { env: r.env, deriv, error };
  });
  return (
    <div class="wide derivation-view">
      <Show when={bool(props.editable, true)}>
        <div class="dv-input sans">
          <span class="label">term</span>
          <input class="input grow" value={term()} onInput={(e) => setTerm(e.currentTarget.value)} spellcheck={false} />
        </div>
      </Show>
      <Show when={res().error}>
        <div class="msg error sans" style={{ margin: '0.4rem 0' }}>
          <span class="msg-icon">✗</span>
          <div class="msg-body msg-text">{res().error}</div>
        </div>
      </Show>
      <Show when={res().deriv} keyed>
        {(d) => <DerivationTree env={res().env} deriv={d} stepwise={bool(props.stepwise, false)} hideTypeFormation={bool(props.hideFormation, true)} title={props.title} />}
      </Show>
    </div>
  );
}
