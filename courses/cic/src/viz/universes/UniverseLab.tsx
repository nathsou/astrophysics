// Where do types live? A universe tower computed by the kernel, and a
// calculator for the universe of a Π-type.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { envFor, check } from '../../app/kernel.ts';
import { TypeChecker } from '../../kernel/core/typechecker.ts';
import { type Level, lzero, lsucc, lparam, limax, lmax, levelToString, toNat, simplifyLevel } from '../../kernel/core/level.ts';
import { Term } from '../Term.tsx';
import type { Expr } from '../../kernel/core/expr.ts';

const DEFAULT = `Nat
Nat → Nat
Nat → Prop
Prop
∀ (p : Prop), p → p
(α : Type) → α → α
Type
Type → Type
List
Eq 2 3
2 = 3 → False
Type 1
(α : Type 1) → α`;

interface Item {
  src: string;
  expr?: Expr;
  type?: Expr;
  level?: Level; // e : Sort level (when e is a type)
  err?: string;
}

const sortName = (l: Level) => {
  const n = toNat(l);
  if (n === 0) return 'Prop';
  if (n === 1) return 'Type';
  if (n !== undefined) return `Type ${n - 1}`;
  return `Sort ${levelToString(l)}`;
};

export function UniverseLab() {
  const [src, setSrc] = createSignal(DEFAULT);
  const env = envFor('cic');
  const items = createMemo<Item[]>(() =>
    src()
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const r = check(`#check ${s}`, env);
        const o = r.results[0]?.output;
        if (!o || o.k !== 'check' || r.messages.some((m) => m.severity === 'error')) return { src: s, err: 'does not typecheck' };
        const tc = new TypeChecker(r.env, o.lctx);
        const t = tc.whnf(o.type);
        return { src: s, expr: o.expr, type: o.type, level: t.k === 'sort' ? t.level : undefined };
      }),
  );
  const bands = [4, 3, 2, 1, 0];
  const inBand = (b: number) => items().filter((i) => i.level && toNat(i.level) === b);
  const other = () => items().filter((i) => !i.level || toNat(i.level) === undefined);

  // Π calculator
  const choices: { label: string; l: Level }[] = [
    { label: 'Prop', l: lzero },
    { label: 'Type', l: lsucc(lzero) },
    { label: 'Type 1', l: lsucc(lsucc(lzero)) },
    { label: 'Type 2', l: lsucc(lsucc(lsucc(lzero))) },
    { label: 'Sort u', l: lparam('u') },
    { label: 'Sort v', l: lparam('v') },
  ];
  const [dom, setDom] = createSignal(1);
  const [cod, setCod] = createSignal(0);
  const [impred, setImpred] = createSignal(true);
  const result = () => {
    const u = choices[dom()].l;
    const v = choices[cod()].l;
    return simplifyLevel(impred() ? limax(u, v) : lmax(u, v));
  };

  return (
    <div class="widget wide unilab">
      <div class="widget-head">
        <span class="widget-title">Universe explorer</span>
        <span class="muted">one term per line — the kernel computes where it lives</span>
      </div>
      <div class="uni-grid">
        <textarea class="uni-input mono" value={src()} onInput={(e) => setSrc(e.currentTarget.value)} spellcheck={false} />
        <div class="uni-tower">
          <For each={bands}>
            {(b) => (
              <div class={`uni-band b${b}`}>
                <div class="uni-band-label">{sortName(b === 0 ? lzero : [...Array(b)].reduce((l) => lsucc(l), lzero as Level))}</div>
                <div class="uni-chips">
                  <For each={inBand(b)}>
                    {(i) => (
                      <span class="uni-chip">
                        <Term env={env} expr={i.expr!} />
                      </span>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
          <Show when={other().length}>
            <div class="uni-other">
              <div class="label">not types (or not placeable)</div>
              <For each={other()}>
                {(i) => (
                  <div class="uni-row">
                    <Show when={!i.err} fallback={<span class="badge err">{i.src}: {i.err}</span>}>
                      <Term env={env} expr={i.expr!} /> <span class="t-punct">:</span> <Term env={env} expr={i.type!} />
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
      <div class="uni-calc sans">
        <span class="label">the universe of a Π-type</span>
        <div class="row" style={{ 'margin-top': '0.4rem' }}>
          <span class="mono">(x : A) → B</span> with <span class="mono">A :</span>
          <select class="input" value={dom()} onChange={(e) => setDom(+e.currentTarget.value)}>
            <For each={choices}>{(c, i) => <option value={i()}>{c.label}</option>}</For>
          </select>
          <span class="mono">B :</span>
          <select class="input" value={cod()} onChange={(e) => setCod(+e.currentTarget.value)}>
            <For each={choices}>{(c, i) => <option value={i()}>{c.label}</option>}</For>
          </select>
          <span>lives in</span>
          <b class="mono uni-result">{sortName(result())}</b>
          <label class="row" style={{ gap: '0.3rem', 'margin-left': 'auto', 'font-size': '0.78rem' }}>
            <input type="checkbox" checked={impred()} onChange={(e) => setImpred(e.currentTarget.checked)} /> impredicative Prop
          </label>
        </div>
        <div class="muted" style={{ 'font-size': '0.78rem', 'margin-top': '0.4rem' }}>
          Rule: <span class="mono">Sort (imax u v)</span>, where <span class="mono">imax u v</span> is <span class="mono">0</span> if <span class="mono">v = 0</span> and{' '}
          <span class="mono">max u v</span> otherwise. {impred() ? '' : 'With impredicativity switched off, the rule is plain max: ∀ over a Type would no longer be a Prop.'}
        </div>
      </div>
    </div>
  );
}
