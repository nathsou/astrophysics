// The typing lab: a λ-term in readable syntax, its de Bruijn form, its typing
// derivation (or where type checking fails), and the verdict as the kernel checks it,
// using the chapter's verified checker.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { parseTm, infer, showDeBruijn, showTm, showTy, toCourse, certificate, TYPING_PRESETS as PRESETS, type Deriv, type Tm } from '../../engines/stlc.ts';
import { Playground } from '../Playground.tsx';



export function TypingLab(props: { term?: string; setup: string }) {
  const [src, setSrc] = createSignal(props.term ?? PRESETS[1]);
  const res = createMemo(() => {
    try {
      const t = parseTm(src());
      toCourse(t); // unbound variables
      return { t, r: infer(t), cert: certificate(src()) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
  const ok = () => res() as { t: Tm; r: ReturnType<typeof infer>; cert: ReturnType<typeof certificate> };
  return (
    <div class="widget typing">
      <div class="widget-head">
        <span class="widget-title">Type checking, with its derivation</span>
      </div>
      <div class="widget-body">
        <label class="inh-input">
          <span class="label">a closed λ-term</span>
          <input class="input mono" value={src()} onInput={(e) => setSrc(e.currentTarget.value)} spellcheck={false} aria-label="a lambda term" />
        </label>
        <div class="row" style={{ gap: '0.3rem', 'flex-wrap': 'wrap', 'margin-top': '0.4rem' }}>
          {PRESETS.map((p) => (
            <button class="btn small mono" onClick={() => setSrc(p)}>
              {p.length > 34 ? p.slice(0, 32) + '…' : p}
            </button>
          ))}
        </div>
        <Show when={!('error' in res())} fallback={<div class="msg error">{(res() as { error: string }).error}</div>}>
          <div class="typing-row">
            <span class="label">de Bruijn form</span> <span class="mono">{showDeBruijn(ok().t)}</span>
          </div>
          <Show
            when={ok().r.ok}
            fallback={
              <div class="inh-verdict none">
                Ill-typed: {(ok().r as { error: string }).error}. <code>infer</code> returns <code>none</code>.
              </div>
            }
          >
            <div class="inh-verdict some">
              Well-typed, of type <span class="mono">{showTy((ok().r as { d: { ty: import('../../engines/stlc.ts').Ty } }).d.ty)}</span>. The derivation that <code>infer</code> follows, conclusion first, each judgement above the premises it needs:
            </div>
            <ul class="typing-tree mono small">
              <DerivNode d={(ok().r as { d: Deriv }).d} />
            </ul>
          </Show>
          <div class="label" style={{ 'margin-top': '0.6rem' }}>
            the verdict, checked by the kernel with the verified checker
          </div>
          <Show when={ok().cert.code} keyed>
            {(code) => <Playground code={code} setup={props.setup} title="Certificate" noBridge />}
          </Show>
        </Show>
      </div>
    </div>
  );
}

/** one judgement of the derivation, with its premises below it */
function DerivNode(props: { d: Deriv }) {
  const ctx = () => props.d.ctx.map((c) => `${c.x} : ${showTy(c.ty)}`).join(', ');
  return (
    <li>
      <span class="typing-rule">{props.d.rule}</span>
      <span class="typing-ctx">{ctx()}</span> ⊢ {showTm(props.d.term)} : <b>{showTy(props.d.ty)}</b>
      <Show when={props.d.index !== undefined}>
        <span class="muted"> (index {props.d.index}: lookup finds {showTy(props.d.ty)})</span>
      </Show>
      <Show when={props.d.premises.length}>
        <ul>
          <For each={props.d.premises}>{(p) => <DerivNode d={p} />}</For>
        </ul>
      </Show>
    </li>
  );
}
