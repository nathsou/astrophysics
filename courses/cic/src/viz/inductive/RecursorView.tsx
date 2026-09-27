// The anatomy of a recursor: what the kernel generates from an inductive declaration.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { envFor, check } from '../../app/kernel.ts';
import { Editor } from '../Editor.tsx';
import { Term } from '../Term.tsx';
import { MessageView } from '../Infoview.tsx';
import { TypeChecker } from '../../kernel/core/typechecker.ts';
import { type Expr, type FVar, mkApps, mkConst, getAppArgs, instantiate1 } from '../../kernel/core/expr.ts';
import { lparam } from '../../kernel/core/level.ts';
import { LocalContext, type Decl } from '../../kernel/core/env.ts';
import { Stepper } from '../../kernel/core/steps.ts';

interface Binder {
  name: string;
  type: Expr;
  lctx: LocalContext;
}

interface Minor {
  ctor: string;
  binder: Binder;
  fields: Binder[];
  ihs: Binder[];
  concl: Expr;
  lctx: LocalContext;
}

function analyse(env: import('../../kernel/core/env.ts').Environment, indName: string) {
  const rec = env.get(indName + '.rec') as Extract<Decl, { kind: 'rec' }> | undefined;
  if (!rec) return undefined;
  const tc = new TypeChecker(env);
  const { fvars, body } = tc.openPis(rec.type);
  const lctx = tc.lctx;
  const binder = (fv: FVar): Binder => {
    const d = lctx.get(fv.id)!;
    const before = lctx.decls.slice(0, lctx.decls.findIndex((x) => x.id === fv.id)).reduce((l, x) => l.push(x), LocalContext.empty);
    return { name: d.name, type: d.type, lctx: before };
  };
  const np = rec.numParams;
  const nm = rec.numMotives;
  const nmin = rec.numMinors;
  const params = fvars.slice(0, np).map(binder);
  const motives = fvars.slice(np, np + nm).map(binder);
  const minorF = fvars.slice(np + nm, np + nm + nmin);
  const indices = fvars.slice(np + nm + nmin, fvars.length - 1).map(binder);
  const major = binder(fvars[fvars.length - 1]);
  // decompose minor premises
  const ind = env.get(indName) as Extract<Decl, { kind: 'inductive' }>;
  const allCtors = rec.all.flatMap((n) => (env.get(n) as Extract<Decl, { kind: 'inductive' }>).ctors);
  const minors: Minor[] = minorF.map((m, i) => {
    const b = binder(m);
    const ctor = allCtors[i];
    const cd = env.get(ctor) as Extract<Decl, { kind: 'ctor' }>;
    const tc2 = new TypeChecker(env, lctx);
    const { fvars: fs, body: concl } = tc2.openPis(b.type);
    const l2 = tc2.lctx;
    const bb = (fv: FVar): Binder => {
      const d = l2.get(fv.id)!;
      const before = l2.decls.slice(0, l2.decls.findIndex((x) => x.id === fv.id)).reduce((l, x) => l.push(x), LocalContext.empty);
      return { name: d.name, type: d.type, lctx: before };
    };
    return { ctor, binder: b, fields: fs.slice(0, cd.numFields).map(bb), ihs: fs.slice(cd.numFields).map(bb), concl, lctx: l2 };
  });
  // ι-rules: rec params motives minors (c params fields) ⟶ …
  const iota = rec.rules.map((rule) => {
    const cd = env.get(rule.ctor) as Extract<Decl, { kind: 'ctor' }>;
    const tc3 = new TypeChecker(env, lctx);
    const recConst = mkConst(rec.name, rec.levelParams.map(lparam));
    // instantiate the constructor's fields with fresh variables
    let ct = cd.type;
    const ps = fvars.slice(0, np);
    for (const p of ps) ct = instantiate1((tc3.whnf(ct) as Extract<Expr, { k: 'pi' }>).body, p);
    const { fvars: fields, body: cres } = tc3.openPis(ct);
    const idx = getAppArgs(cres).slice(np);
    const ctorApp = mkApps(mkConst(rule.ctor, ind.levelParams.map(lparam)), [...ps, ...fields]);
    const lhs = mkApps(recConst, [...fvars.slice(0, np + nm + nmin), ...idx, ctorApp]);
    const st = new Stepper(env);
    let rhs = lhs;
    try {
      rhs = st.contract(lhs, { path: [], kind: 'iota' });
    } catch {
      /* ignore */
    }
    return { ctor: rule.ctor, lhs, rhs, lctx: tc3.lctx };
  });
  return { rec, params, motives, minors, indices, major, concl: body, lctx, iota, elimOnlyProp: ind.elimOnlyProp };
}

export function RecursorView(props: { code: string; name: string; title?: string; editable?: boolean | string }) {
  const [src, setSrc] = createSignal(props.code.trim());
  const [name, setName] = createSignal(props.name);
  const result = createMemo(() => {
    const r = check(src(), envFor('cic'));
    const a = analyse(r.env, name()) ?? analyse(r.env, r.results.map((x) => (x.output?.k === 'decl' ? x.output.main : '')).filter(Boolean).pop() ?? '');
    return { r, a };
  });
  const env = () => result().r.env;
  const B = (p: { b: Binder; cls: string }) => (
    <span class={`rv-binder ${p.cls}`}>
      <span class="rv-bname">{p.b.name}</span>
      <span class="t-punct"> : </span>
      <Term env={env()} expr={p.b.type} lctx={p.b.lctx} />
    </span>
  );
  return (
    <div class="widget wide recview">
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'Anatomy of a recursor'}</span>
        <span class="grow" />
        <Show when={result().a}>
          <span class="badge">{result().a!.rec.name}</span>
          <Show when={result().a!.elimOnlyProp}>
            <span class="badge warn">eliminates only into Prop</span>
          </Show>
        </Show>
      </div>
      <Show when={props.editable !== false && props.editable !== 'false'}>
        <div style={{ 'border-bottom': '1px solid var(--rule)' }}>
          <Editor value={src()} onChange={setSrc} minHeight="4rem" maxHeight="14rem" lineNumbers={false} />
        </div>
      </Show>
      <For each={result().r.messages.filter((m) => m.severity === 'error')}>{(m) => <MessageView env={env()} m={m} />}</For>
      <Show when={result().a}>
        {(() => {
          const a = result().a!;
          return (
            <div class="widget-body rv-body">
              <Show when={a.params.length}>
                <div class="rv-group">
                  <div class="rv-label">parameters</div>
                  <div class="rv-items">
                    <For each={a.params}>{(b) => <B b={b} cls="param" />}</For>
                  </div>
                </div>
              </Show>
              <div class="rv-group">
                <div class="rv-label">motive</div>
                <div class="rv-items">
                  <For each={a.motives}>{(b) => <B b={b} cls="motive" />}</For>
                </div>
                <div class="rv-note">what we want to construct (or prove) for each element</div>
              </div>
              <div class="rv-group">
                <div class="rv-label">minor premises</div>
                <div class="rv-items col">
                  <For each={a.minors}>
                    {(m) => (
                      <div class="rv-minor">
                        <div class="rv-minor-head">
                          case <span class="t-ctor">{m.ctor}</span>
                        </div>
                        <div class="rv-minor-body">
                          <Show when={m.fields.length}>
                            <span class="rv-sub">fields</span>
                            <For each={m.fields}>{(b) => <B b={b} cls="field" />}</For>
                          </Show>
                          <Show when={m.ihs.length}>
                            <span class="rv-sub">induction hypotheses</span>
                            <For each={m.ihs}>{(b) => <B b={b} cls="ih" />}</For>
                          </Show>
                          <span class="rv-sub">must produce</span>
                          <span class="rv-binder concl">
                            <Term env={env()} expr={m.concl} lctx={m.lctx} />
                          </span>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
              <Show when={a.indices.length}>
                <div class="rv-group">
                  <div class="rv-label">indices</div>
                  <div class="rv-items">
                    <For each={a.indices}>{(b) => <B b={b} cls="index" />}</For>
                  </div>
                </div>
              </Show>
              <div class="rv-group">
                <div class="rv-label">major premise</div>
                <div class="rv-items">
                  <B b={a.major} cls="major" />
                </div>
              </div>
              <div class="rv-group">
                <div class="rv-label">result</div>
                <div class="rv-items">
                  <span class="rv-binder concl">
                    <Term env={env()} expr={a.concl} lctx={a.lctx} />
                  </span>
                </div>
              </div>
              <div class="rv-group">
                <div class="rv-label">ι-reduction</div>
                <div class="rv-items col">
                  <For each={a.iota}>
                    {(r) => (
                      <div class="rv-iota">
                        <Term env={env()} expr={r.lhs} lctx={r.lctx} opts={{ explicit: false }} />
                        <span class="rv-arrow"> ⟶ </span>
                        <Term env={env()} expr={r.rhs} lctx={r.lctx} />
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          );
        })()}
      </Show>
      <div class="widget-foot row">
        <span>Type:</span>
        <input class="input" value={name()} onInput={(e) => setName(e.currentTarget.value)} style={{ width: '10rem' }} />
        <span class="muted">Edit the declaration above; the kernel regenerates the recursor as you type.</span>
      </div>
    </div>
  );
}
