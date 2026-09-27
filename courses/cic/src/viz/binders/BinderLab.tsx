// Named terms versus de Bruijn indices, with arcs from occurrences to binders,
// and a comparison of naive and capture-avoiding substitution.

import { For, Show, createMemo, createSignal } from 'solid-js';
import * as L from '../../kernel/untyped/lambda.ts';

interface Tok {
  text: string;
  kind: 'lam' | 'binder' | 'var' | 'free' | 'punct' | 'space' | 'index';
  /** binder id for binders, bound-to id for variables */
  bid?: number;
}

function namedTokens(t: L.U): Tok[] {
  const out: Tok[] = [];
  const go = (t: L.U, prec: number, env: Map<string, number>) => {
    switch (t.k) {
      case 'var':
      case 'def':
        out.push({ text: t.name, kind: env.has(t.name) ? 'var' : 'free', bid: env.get(t.name) });
        return;
      case 'lam': {
        if (prec > 0) out.push({ text: '(', kind: 'punct' });
        out.push({ text: 'λ', kind: 'lam' });
        out.push({ text: t.name, kind: 'binder', bid: t.id });
        out.push({ text: '. ', kind: 'punct' });
        const e = new Map(env);
        e.set(t.name, t.id);
        go(t.body, 0, e);
        if (prec > 0) out.push({ text: ')', kind: 'punct' });
        return;
      }
      case 'app':
        if (prec > 1) out.push({ text: '(', kind: 'punct' });
        go(t.fn, 1, env);
        out.push({ text: ' ', kind: 'space' });
        go(t.arg, 2, env);
        if (prec > 1) out.push({ text: ')', kind: 'punct' });
    }
  };
  go(t, 0, new Map());
  return out;
}

function dbTokens(t: L.U): Tok[] {
  const out: Tok[] = [];
  const go = (t: L.U, prec: number, env: { name: string; id: number }[]) => {
    switch (t.k) {
      case 'var':
      case 'def': {
        let i = -1;
        for (let k = env.length - 1; k >= 0; k--)
          if (env[k].name === t.name) {
            i = env.length - 1 - k;
            break;
          }
        if (i < 0) out.push({ text: t.name, kind: 'free' });
        else out.push({ text: String(i), kind: 'index', bid: env[env.length - 1 - i].id });
        return;
      }
      case 'lam':
        if (prec > 0) out.push({ text: '(', kind: 'punct' });
        out.push({ text: 'λ', kind: 'binder', bid: t.id });
        out.push({ text: ' ', kind: 'space' });
        go(t.body, 0, [...env, { name: t.name, id: t.id }]);
        if (prec > 0) out.push({ text: ')', kind: 'punct' });
        return;
      case 'app':
        if (prec > 1) out.push({ text: '(', kind: 'punct' });
        go(t.fn, 1, env);
        out.push({ text: ' ', kind: 'space' });
        go(t.arg, 2, env);
        if (prec > 1) out.push({ text: ')', kind: 'punct' });
    }
  };
  go(t, 0, []);
  return out;
}

/** a line of monospace tokens with arcs from each bound occurrence to its binder */
function ArcLine(props: { toks: Tok[]; label: string; hover: number | undefined; setHover: (id: number | undefined) => void }) {
  const CW = 10.2; // px per character (font-size 17px mono)
  const layout = createMemo(() => {
    let col = 0;
    return props.toks.map((t) => {
      const x = col * CW;
      col += [...t.text].length;
      return { ...t, x, w: [...t.text].length * CW };
    });
  });
  const width = () => layout().reduce((a, t) => Math.max(a, t.x + t.w), 0) + 8;
  const arcs = createMemo(() => {
    const binders = new Map<number, number>();
    for (const t of layout()) if ((t.kind === 'binder') && t.bid !== undefined) binders.set(t.bid, t.x + t.w / 2);
    return layout()
      .filter((t) => (t.kind === 'var' || t.kind === 'index') && t.bid !== undefined && binders.has(t.bid))
      .map((t) => ({ from: t.x + t.w / 2, to: binders.get(t.bid!)!, bid: t.bid! }));
  });
  const maxH = () => Math.min(70, 14 + arcs().reduce((a, r) => Math.max(a, Math.abs(r.from - r.to)), 0) * 0.28);
  return (
    <div class="arcline">
      <span class="label">{props.label}</span>
      <div class="arcline-scroll">
        <svg width={width()} height={maxH() + 30} class="arcline-svg">
          <For each={arcs()}>
            {(a) => {
              const h = () => 10 + Math.abs(a.from - a.to) * 0.28;
              return (
                <path
                  class={`arc ${props.hover === a.bid ? 'on' : ''}`}
                  d={`M ${a.from} ${maxH() + 6} C ${a.from} ${maxH() + 6 - h()}, ${a.to} ${maxH() + 6 - h()}, ${a.to} ${maxH() + 6}`}
                />
              );
            }}
          </For>
          <For each={layout()}>
            {(t) => (
              <text
                x={t.x}
                y={maxH() + 24}
                class={`arc-tok k-${t.kind} ${t.bid !== undefined && props.hover === t.bid ? 'on' : ''}`}
                onMouseEnter={() => props.setHover(t.bid)}
                onMouseLeave={() => props.setHover(undefined)}
                style={{ "white-space": "pre" }}
              >
                {t.text}
              </text>
            )}
          </For>
        </svg>
      </div>
    </div>
  );
}

export function BinderLab(props: { code: string; title?: string }) {
  const [src, setSrc] = createSignal(props.code);
  const [hover, setHover] = createSignal<number>();
  const term = createMemo(() => {
    try {
      return { t: L.parseTerm(src()) };
    } catch (e) {
      return { err: (e as Error).message };
    }
  });
  return (
    <div class="widget wide">
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'Binders and indices'}</span>
        <input class="input grow" value={src()} onInput={(e) => setSrc(e.currentTarget.value)} spellcheck={false} />
      </div>
      <div class="widget-body">
        <Show when={term().t} fallback={<div class="msg error sans">{term().err}</div>}>
          <ArcLine toks={namedTokens(term().t!)} label="named" hover={hover()} setHover={setHover} />
          <ArcLine toks={dbTokens(term().t!)} label="de Bruijn" hover={hover()} setHover={setHover} />
        </Show>
      </div>
      <div class="widget-foot">
        Each arc joins a variable occurrence to the λ that binds it. A de Bruijn index counts how many λs you cross on the way up to the binder. Free variables (no arc) keep their names. Hover a binder to highlight its occurrences.
      </div>
    </div>
  );
}

export function SubstLab(props: { term: string; x: string; arg: string; title?: string }) {
  const [m, setM] = createSignal(props.term);
  const [x, setX] = createSignal(props.x);
  const [n, setN] = createSignal(props.arg);
  const res = createMemo(() => {
    try {
      const M = L.parseTerm(m());
      const N = L.parseTerm(n());
      const ev: L.SubstEvent[] = [];
      const good = L.subst(M, x().trim(), N, ev);
      const naive = L.naiveSubst(M, x().trim(), N);
      const same = L.alphaEq(good, naive);
      return { good, naive, ev, same, fvN: [...L.freeVars(N)] };
    } catch (e) {
      return { err: (e as Error).message };
    }
  });
  return (
    <div class="widget wide">
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'Substitution'}</span>
      </div>
      <div class="widget-body subst-grid">
        <label class="sans">
          <span class="label">term M</span>
          <input class="input" value={m()} onInput={(e) => setM(e.currentTarget.value)} spellcheck={false} />
        </label>
        <label class="sans">
          <span class="label">variable x</span>
          <input class="input" value={x()} onInput={(e) => setX(e.currentTarget.value)} spellcheck={false} style={{ width: '5rem' }} />
        </label>
        <label class="sans">
          <span class="label">replacement N</span>
          <input class="input" value={n()} onInput={(e) => setN(e.currentTarget.value)} spellcheck={false} />
        </label>
      </div>
      <Show when={!res().err} fallback={<div class="msg error sans" style={{ margin: '0 1rem 1rem' }}>{res().err}</div>}>
        <div class="subst-results">
          <div class={`subst-box ${res().same ? '' : 'bad'}`}>
            <span class="label">naive textual replacement</span>
            <div class="mono">{L.print(res().naive!)}</div>
            <Show when={!res().same}>
              <div class="sans subst-note">✗ a free variable of N ({res().fvN!.join(', ')}) was captured by a binder in M</div>
            </Show>
          </div>
          <div class="subst-box good">
            <span class="label">capture-avoiding substitution M[x := N]</span>
            <div class="mono">{L.print(res().good!)}</div>
            <Show when={res().ev!.length > 0}>
              <div class="sans subst-note">renamed: {res().ev!.map((e) => `${e.from} ↦ ${e.to}`).join(', ')}</div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
