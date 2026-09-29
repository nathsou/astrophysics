// The kernel lab: a term of the chapter's little dependent type theory, checked by a
// mirror of the chapter's checker, with the trace of every judgement (⇒ infer, ⇐ check),
// the conversion checks with their normal forms, and switches that break the rules.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { parse, tc, show, norm, FUEL, kernelCertificate, KERNEL_PRESETS, type Breaks, type Node } from '../../engines/depcheck.ts';
import { Playground } from '../Playground.tsx';

export function KernelLab(props: { term?: string; setup: string }) {
  const [src, setSrc] = createSignal(props.term ?? KERNEL_PRESETS[1].src);
  const [br, setBr] = createSignal<Breaks>({});
  const res = createMemo(() => {
    try {
      const t = parse(src());
      return { t, node: tc([], [], t, undefined, br()), cert: kernelCertificate(src()) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
  const ok = () => res() as { t: import('../../engines/depcheck.ts').Tm; node: Node; cert: string };
  const broken = () => Object.values(br()).some(Boolean);
  const toggle = (k: keyof Breaks) => setBr({ ...br(), [k]: !br()[k] });
  const note = () => KERNEL_PRESETS.find((p) => p.src === src())?.note;
  return (
    <div class="widget kernel-lab">
      <div class="widget-head">
        <span class="widget-title">A kernel at work</span>
      </div>
      <div class="widget-body">
        <label class="inh-input">
          <span class="label">a term</span>
          <input class="input mono" value={src()} onInput={(e) => setSrc(e.currentTarget.value)} spellcheck={false} aria-label="a term of the little type theory" />
        </label>
        <div class="row" style={{ gap: '0.3rem', 'flex-wrap': 'wrap', 'margin-top': '0.4rem' }}>
          <For each={KERNEL_PRESETS}>
            {(p) => (
              <button class="btn small mono" title={p.note} onClick={() => setSrc(p.src)}>
                {p.src.length > 30 ? p.src.slice(0, 28) + '…' : p.src}
              </button>
            )}
          </For>
        </div>
        <Show when={note()}>
          <div class="muted small" style={{ 'margin-top': '0.3rem' }}>
            {note()}
          </div>
        </Show>
        <div class="kernel-breaks">
          <span class="label">break a rule</span>
          <label>
            <input type="checkbox" checked={!!br().typeInType} onChange={() => toggle('typeInType')} /> <span class="mono">Type : Type</span>
          </label>
          <label>
            <input type="checkbox" checked={!!br().skipArg} onChange={() => toggle('skipArg')} /> do not check arguments
          </label>
          <label>
            <input type="checkbox" checked={!!br().skipConv} onChange={() => toggle('skipConv')} /> skip the conversion check
          </label>
        </div>
        <Show when={!('error' in res())} fallback={<div class="msg error">{(res() as { error: string }).error}</div>}>
          <Show
            when={ok().node.result}
            fallback={<div class="inh-verdict none">Rejected. The failing judgement is marked below.</div>}
          >
            {(T) => (
              <div class={`inh-verdict ${broken() ? 'many' : 'some'}`}>
                Accepted{broken() ? ' (by a broken kernel)' : ''}, of type <span class="mono">{show(T())}</span>. It computes to{' '}
                <span class="mono">{show(norm(FUEL, ok().t))}</span>.
              </div>
            )}
          </Show>
          <ul class="kernel-trace mono small">
            <TraceNode n={ok().node} />
          </ul>
          <div class="label" style={{ 'margin-top': '0.6rem' }}>
            the same term, checked by the chapter's checker (in the course language, with no switches)
          </div>
          <Show when={ok().cert} keyed>
            {(code) => <Playground code={code} setup={props.setup} title="The course-language checker" noBridge />}
          </Show>
        </Show>
      </div>
    </div>
  );
}

function TraceNode(props: { n: Node }) {
  const n = () => props.n;
  const failed = () => !n().result;
  return (
    <li classList={{ bad: failed() && !n().children.some((c) => !c.result) }}>
      <span class="kernel-mode" title={n().mode === 'infer' ? 'infer a type' : 'check against a type'}>
        {n().mode === 'infer' ? '⇒' : '⇐'}
      </span>{' '}
      <span class="muted">{n().names.filter((x) => x !== '_').length ? n().names.filter((x) => x !== '_').reverse().join(', ') + ' ' : ''}⊢</span> {show(n().term, n().names)}
      <Show when={n().expected}>
        {(E) => <span> ⇐ {show(E(), n().names)}</span>}
      </Show>
      <Show when={n().result && n().mode === 'infer'}>
        <span>
          {' '}
          ⇒ <b>{show(n().result!, n().names)}</b>
        </span>
      </Show>
      <Show when={n().result && n().mode === 'check'}>
        <span class="ok"> ✓</span>
      </Show>
      <Show when={n().conv}>
        {(c) => (
          <div class="kernel-conv">
            conversion: {show(c().na, n().names)} {c().ok ? (c().skipped ? '≟ (not checked)' : '≡') : '≢'} {show(c().nb, n().names)}
          </div>
        )}
      </Show>
      <Show when={n().error && !n().children.some((c) => !c.result)}>
        <div class="kernel-err">✗ {n().error}</div>
      </Show>
      <Show when={n().children.length}>
        <ul>
          <For each={n().children}>{(c) => <TraceNode n={c} />}</For>
        </ul>
      </Show>
    </li>
  );
}
