// The untyped λ-calculus laboratory.

import { For, Show, Switch, Match, createMemo, createSignal, onCleanup } from 'solid-js';
import * as L from '@kernel/untyped/lambda.ts';
import { Editor } from '../Editor.tsx';
import { UTermView } from './UTermView.tsx';
import { SyntaxTreeView } from './SyntaxTreeView.tsx';
import { TrompView } from './TrompView.tsx';
import { ReductionGraphView } from './ReductionGraphView.tsx';

const HISTORY = 60;

type View = 'text' | 'tree' | 'tromp' | 'graph' | 'debruijn';

const viewNames: Record<View, string> = {
  text: 'Steps',
  tree: 'Syntax tree',
  tromp: 'Diagram',
  graph: 'All reductions',
  debruijn: 'de Bruijn',
};

export interface LambdaLabProps {
  code: string;
  title?: string;
  strategy?: L.Strategy;
  /** comma separated list of views */
  views?: string;
  view?: View;
  /** include the standard library of Church encodings */
  stdlib?: boolean | string;
  editable?: boolean | string;
  maxSteps?: number;
}

interface Hist {
  term: L.U;
  step?: L.StepResult;
}

export function LambdaLab(props: LambdaLabProps) {
  const useStd = () => props.stdlib === undefined || props.stdlib === true || props.stdlib === 'true';
  const [src, setSrc] = createSignal(props.code.trim());
  const [strategy, setStrategy] = createSignal<L.Strategy>(props.strategy ?? 'normal');
  const views = () => (props.views ? (props.views.split(/[\s,]+/) as View[]) : (['text', 'tree', 'tromp', 'graph'] as View[]));
  const [view, setView] = createSignal<View>(props.view ?? views()[0]);
  const [recognise, setRecognise] = createSignal(true);
  const [autoplay, setAutoplay] = createSignal(false);
  let timer: number | undefined;
  onCleanup(() => clearInterval(timer));

  const parsed = createMemo(() => {
    try {
      const prog = L.parseProgram((useStd() ? L.STDLIB + '\n' : '') + src());
      if (!prog.main) return { error: 'write a term to reduce (on its own line)' };
      return { prog };
    } catch (e) {
      const err = e as L.UParseError;
      return { error: err.message };
    }
  });
  const [hist, setHist] = createSignal<Hist[]>([]);
  // reset history when the program changes
  createMemo(() => {
    const p = parsed();
    setAutoplay(false);
    clearInterval(timer);
    setHist(p.prog ? [{ term: p.prog.main! }] : []);
  });
  const defs = () => parsed().prog?.defs;
  const cur = () => hist()[hist().length - 1]?.term;
  const next = createMemo(() => (cur() ? L.nextRedex(cur()!, strategy(), defs()) : undefined));
  const allRedexes = createMemo(() => (cur() ? L.redexes(cur()!, defs()) : []));
  const lastStep = () => hist()[hist().length - 1]?.step;
  const fresh = createMemo(() => {
    const s = lastStep();
    if (!s?.info) return new Set<number>();
    const ids = new Set<number>();
    const collect = (u: L.U) => {
      ids.add(u.id);
      if (u.k === 'lam') collect(u.body);
      if (u.k === 'app') {
        collect(u.fn);
        collect(u.arg);
      }
    };
    collect(s.info.arg);
    return ids;
  });

  const doStep = (r?: L.Redex) => {
    const t = cur();
    if (!t) return false;
    const red = r ?? next();
    if (!red) return false;
    const s = L.contract(t, red, defs());
    if (L.size(s.term) > 3000) return false;
    setHist([...hist(), { term: s.term, step: s }]);
    return true;
  };
  const back = () => hist().length > 1 && setHist(hist().slice(0, -1));
  const reset = () => setHist(hist().slice(0, 1));
  const run = () => {
    let n = 0;
    const max = props.maxSteps ?? 500;
    let h = hist();
    while (n < max) {
      const t = h[h.length - 1].term;
      const r = L.nextRedex(t, strategy(), defs());
      if (!r) break;
      const s = L.contract(t, r, defs());
      if (L.size(s.term) > 3000) break;
      h = [...h, { term: s.term, step: s }];
      n++;
    }
    setHist(h);
  };
  const toggleAuto = () => {
    if (autoplay()) {
      setAutoplay(false);
      clearInterval(timer);
      return;
    }
    setAutoplay(true);
    timer = window.setInterval(() => {
      if (!doStep()) {
        setAutoplay(false);
        clearInterval(timer);
      }
    }, 650);
  };
  const described = () => (cur() && !next() ? L.describeValue(cur()!, defs()) : undefined);
  const counts = () => {
    let b = 0,
      d = 0;
    for (const h of hist()) {
      if (h.step?.redex.kind === 'beta') b++;
      if (h.step?.redex.kind === 'delta') d++;
    }
    return { b, d };
  };

  return (
    <div class="widget lambdalab wide">
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'λ-calculus lab'}</span>
        <div class="seg">
          <For each={views()}>
            {(v) => (
              <button class={view() === v ? 'on' : ''} onClick={() => setView(v)}>
                {viewNames[v]}
              </button>
            )}
          </For>
        </div>
        <span class="grow" />
        <select class="input" value={strategy()} onChange={(e) => setStrategy(e.currentTarget.value as L.Strategy)} title={L.strategyInfo[strategy()].blurb}>
          <For each={Object.entries(L.strategyInfo)}>{([k, v]) => <option value={k}>{v.name}</option>}</For>
        </select>
      </div>
      <Show when={props.editable !== false && props.editable !== 'false'}>
        <div class="ll-editor">
          <Editor value={src()} onChange={setSrc} lang="lambda" minHeight="2.4rem" maxHeight="10rem" lineNumbers={false} />
        </div>
      </Show>
      <Show when={parsed().error}>
        <div class="msg error" style={{ margin: '0.6rem' }}>
          <span class="msg-icon">✗</span>
          <div class="msg-body sans">{parsed().error}</div>
        </div>
      </Show>
      <Show when={cur()}>
        <div class="ll-controls sans">
          <div class="seg">
            <button onClick={reset} disabled={hist().length <= 1} title="back to the start">
              ⏮
            </button>
            <button onClick={back} disabled={hist().length <= 1} title="undo a step">
              ◀
            </button>
            <button onClick={toggleAuto} disabled={!next() && !autoplay()} title="play">
              {autoplay() ? '❚❚' : '▶'}
            </button>
            <button onClick={() => doStep()} disabled={!next()} title="contract the next redex">
              step ▶|
            </button>
            <button onClick={run} disabled={!next()} title="reduce to normal form (if it exists)">
              normalise ⏭
            </button>
          </div>
          <span class="badge">{hist().length - 1} steps</span>
          <Show when={counts().b}>
            <span class="badge beta">β × {counts().b}</span>
          </Show>
          <Show when={counts().d}>
            <span class="badge delta">δ × {counts().d}</span>
          </Show>
          <span class="badge">size {L.size(cur()!)}</span>
          <span class="grow" />
          <label class="row" style={{ gap: '0.3rem', 'font-size': '0.75rem' }}>
            <input type="checkbox" checked={recognise()} onChange={(e) => setRecognise(e.currentTarget.checked)} /> show numerals
          </label>
        </div>
        <div class="ll-main">
          <Switch>
            <Match when={view() === 'text'}>
              <div class="ll-history" ref={(el) => requestAnimationFrame(() => (el.scrollTop = el.scrollHeight))}>
                <Show when={hist().length > HISTORY}>
                  <div class="muted sans" style={{ 'font-size': '0.75rem', padding: '0.2rem 0.3rem' }}>
                    … {hist().length - HISTORY} earlier steps not shown
                  </div>
                </Show>
                <For each={hist().slice(-HISTORY)}>
                  {(h, j) => {
                    const i = () => j() + Math.max(0, hist().length - HISTORY);
                    return (
                    <div class={`ll-row ${i() === hist().length - 1 ? 'current' : ''}`}>
                      <span class="ll-step sans">
                        <Show when={h.step} fallback={<span class="muted">start</span>}>
                          <span class={`badge ${h.step!.redex.kind}`}>{h.step!.redex.kind === 'beta' ? 'β' : 'δ'}</span>
                        </Show>
                      </span>
                      <Show
                        when={i() === hist().length - 1}
                        fallback={<UTermView term={h.term} recognise={recognise()} class="past" />}
                      >
                        <UTermView term={h.term} next={next()} redexes={allRedexes()} onRedexClick={(r) => doStep(r)} recognise={recognise()} fresh={fresh()} />
                      </Show>
                      <Show when={h.step?.info?.renames.length}>
                        <span class="badge warn sans" title="a bound variable was renamed to avoid capture">
                          α: {h.step!.info!.renames.map((r) => `${r.from}→${r.to}`).join(', ')}
                        </span>
                      </Show>
                    </div>
                    );
                  }}
                </For>
              </div>
            </Match>
            <Match when={view() === 'tree'}>
              <div class="ll-current">
                <UTermView term={cur()!} next={next()} redexes={allRedexes()} onRedexClick={(r) => doStep(r)} recognise={recognise()} fresh={fresh()} />
              </div>
              <SyntaxTreeView term={cur()!} next={next()} />
            </Match>
            <Match when={view() === 'tromp'}>
              <div class="ll-current">
                <UTermView term={cur()!} next={next()} redexes={allRedexes()} onRedexClick={(r) => doStep(r)} recognise={recognise()} />
              </div>
              <TrompView term={L.expandDefs(cur()!, defs() ?? new Map())} next={next()?.kind === 'beta' ? next() : undefined} />
            </Match>
            <Match when={view() === 'graph'}>
              <div class="ll-current">
                <UTermView term={cur()!} recognise={recognise()} />
              </div>
              <ReductionGraphView term={cur()!} defs={defs()} strategy={strategy()} />
            </Match>
            <Match when={view() === 'debruijn'}>
              <div class="ll-debruijn">
                <div>
                  <span class="label">named</span>
                  <div class="mono">{L.print(cur()!)}</div>
                </div>
                <div>
                  <span class="label">de Bruijn</span>
                  <div class="mono">{L.dbToString(L.toDB(cur()!, defs()))}</div>
                </div>
              </div>
            </Match>
          </Switch>
        </div>
        <div class="widget-foot">
          <Show
            when={next()}
            fallback={
              <span>
                <span class="badge ok">normal form</span> no redex left{described() ? ` — this is ${described()}` : ''}.
              </span>
            }
          >
            <span>
              Next ({L.strategyInfo[strategy()].name.toLowerCase()}): the highlighted {next()!.kind === 'beta' ? 'β-redex' : 'definition'}.{' '}
              <span class="muted">Click any λ that heads a redex to contract that one instead.</span>
            </span>
          </Show>
        </div>
      </Show>
    </div>
  );
}
