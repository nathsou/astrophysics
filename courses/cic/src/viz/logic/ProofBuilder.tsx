// Natural deduction proofs, built goal-first, with their proof terms.

import { For, Show, createMemo, createSignal } from 'solid-js';
import * as ND from '@kernel/logic/nd.ts';
import { envFor, check } from '../../app/kernel.ts';

export interface ProofBuilderProps {
  goal: string;
  title?: string;
  editable?: boolean | string;
  classical?: boolean | string;
}

type F = ND.F;

function applyHyp(n: ND.PNode, h: ND.Hyp): ND.PNode | string {
  // h : A₁ → … → Aₙ → goal
  const prem: F[] = [];
  let f = h.f;
  while (!ND.feq(f, n.goal)) {
    if (f.k !== 'imp') return `${h.name} does not conclude the goal`;
    prem.push(f.a);
    f = f.b;
  }
  const build = (goal: F, k: number): ND.PNode => {
    // hypothesis applied to the first k premises yields A_{k+1} → … → goal
    if (k === 0) return { ...ND.newGoal(goal, n.ctx), rule: 'hyp', hyp: h.name };
    const aux = prem[k - 1];
    return { ...ND.newGoal(goal, n.ctx), rule: 'impE', children: [build(ND.imp(aux, goal), k - 1), ND.newGoal(aux, n.ctx)] };
  };
  const r = build(n.goal, prem.length);
  return { ...r, id: n.id };
}

function suggestions(n: ND.PNode, rule: ND.RuleId): F[] {
  const out: F[] = [];
  const add = (f: F) => {
    if (!out.some((g) => ND.feq(g, f))) out.push(f);
  };
  for (const h of n.ctx) {
    const f = h.f;
    if (rule === 'impE' && f.k === 'imp' && ND.feq(f.b, n.goal)) add(f.a);
    if (rule === 'andE1' && f.k === 'and' && ND.feq(f.a, n.goal)) add(f.b);
    if (rule === 'andE2' && f.k === 'and' && ND.feq(f.b, n.goal)) add(f.a);
    if (rule === 'orE' && f.k === 'or') add(f);
    if (rule === 'impE' && f.k === 'imp' && f.b.k === 'imp') {
      /* partial applications are handled by "use hypothesis" */
    }
  }
  return out;
}

export function ProofBuilder(props: ProofBuilderProps) {
  const [goalSrc, setGoalSrc] = createSignal(props.goal);
  const parsed = createMemo(() => {
    try {
      return { f: ND.parseFormula(goalSrc()) };
    } catch (e) {
      return { err: (e as Error).message };
    }
  });
  const [root, setRoot] = createSignal<ND.PNode | undefined>();
  const [history, setHistory] = createSignal<ND.PNode[]>([]);
  const [selected, setSelected] = createSignal<number>();
  const [pending, setPending] = createSignal<ND.RuleId>();
  const [auxSrc, setAuxSrc] = createSignal('');
  const [error, setError] = createSignal('');
  const [hoverNode, setHoverNode] = createSignal<number>();
  const classical = () => props.classical === true || props.classical === 'true';

  const start = () => {
    const p = parsed();
    if (!p.f) return;
    const r = ND.newGoal(p.f, []);
    setRoot(r);
    setHistory([]);
    setSelected(r.id);
    setPending(undefined);
    setError('');
  };
  start();

  const find = (n: ND.PNode | undefined, id: number | undefined): ND.PNode | undefined => {
    if (!n || id === undefined) return undefined;
    if (n.id === id) return n;
    for (const c of n.children) {
      const r = find(c, id);
      if (r) return r;
    }
    return undefined;
  };
  const sel = () => find(root(), selected());
  const commit = (next: ND.PNode) => {
    setHistory([...history(), root()!]);
    setRoot(next);
    setPending(undefined);
    setAuxSrc('');
    setError('');
    const open = ND.openGoals(next);
    setSelected(open[0]?.id);
  };
  const apply = (rule: ND.RuleId, args: ND.RuleArgs = {}) => {
    const n = sel();
    if (!n) return;
    const r = ND.applyRule(n, rule, args);
    if (typeof r === 'string') {
      if (!args.aux && ['impE', 'andE1', 'andE2', 'orE', 'lem'].includes(rule)) {
        setPending(rule);
        setError('');
        return;
      }
      setError(r);
      return;
    }
    commit(ND.replaceNode(root()!, n.id, () => r));
  };
  const useHyp = (h: ND.Hyp) => {
    const n = sel();
    if (!n) return;
    const r = applyHyp(n, h);
    if (typeof r === 'string') return setError(r);
    commit(ND.replaceNode(root()!, n.id, () => r));
  };
  const submitAux = (f?: F) => {
    let aux = f;
    if (!aux) {
      try {
        aux = ND.parseFormula(auxSrc());
      } catch (e) {
        return setError((e as Error).message);
      }
    }
    apply(pending()!, { aux });
  };
  const undo = () => {
    const h = history();
    if (!h.length) return;
    setRoot(h[h.length - 1]);
    setHistory(h.slice(0, -1));
    setSelected(ND.openGoals(h[h.length - 1])[0]?.id);
    setPending(undefined);
  };
  const complete = () => !!root() && ND.isComplete(root()!);
  const term = createMemo(() => (root() ? ND.proofTerm(root()!) : []));
  const leanCode = () => {
    const f = parsed().f!;
    const as = [...ND.atoms(f)];
    return `theorem my_proof${as.length ? ` (${as.join(' ')} : Prop)` : ''} : ${ND.fLean(f)} :=\n  ${term().map((p) => p.text).join('')}`;
  };
  const kernelOk = createMemo(() => {
    if (!complete() || (root() && ND.usesClassical(root()!))) return undefined;
    const r = check(leanCode(), envFor('cic'));
    return !r.messages.some((m) => m.severity === 'error');
  });
  const tautology = createMemo(() => (parsed().f ? ND.isTautology(parsed().f!) : true));

  const Node = (p: { n: ND.PNode }) => {
    const n = p.n;
    const isOpen = () => !n.rule;
    return (
      <div class={`nd-node ${hoverNode() === n.id ? 'hl' : ''}`} onMouseEnter={(e) => (e.stopPropagation(), setHoverNode(n.id))} onMouseLeave={() => setHoverNode(undefined)}>
        <div class="nd-premises">
          <For each={n.children}>{(c) => <Node n={c} />}</For>
          <Show when={n.rule === 'hyp'}>
            <span class="nd-hypmark">[{n.hyp}]</span>
          </Show>
        </div>
        <Show when={!isOpen()}>
          <div class="nd-bar" />
          <div class="nd-annot">
            {ND.ruleInfo[n.rule!].label}
            <Show when={n.rule === 'impI'}>
              <sup>{n.hyp}</sup>
            </Show>
            <Show when={n.rule === 'orE'}>
              <sup>{n.hyps!.join(',')}</sup>
            </Show>
          </div>
        </Show>
        <div
          class={`nd-concl ${isOpen() ? 'open' : ''} ${selected() === n.id ? 'sel' : ''}`}
          onClick={() => isOpen() && (setSelected(n.id), setPending(undefined))}
          title={isOpen() ? 'open goal: click to work on it' : undefined}
        >
          {ND.fstr(n.goal)}
        </div>
      </div>
    );
  };

  return (
    <div class="widget wide proofbuilder">
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'Proof builder'}</span>
        <Show when={props.editable !== false && props.editable !== 'false'}>
          <input class="input grow" value={goalSrc()} onInput={(e) => setGoalSrc(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && start()} spellcheck={false} />
          <button class="btn small" onClick={start} disabled={!parsed().f}>
            prove this
          </button>
        </Show>
        <span class="grow" />
        <button class="btn small ghost" onClick={undo} disabled={!history().length}>
          undo
        </button>
        <button class="btn small ghost" onClick={start}>
          restart
        </button>
      </div>
      <Show when={parsed().err}>
        <div class="msg error sans" style={{ margin: '0.6rem' }}>
          {parsed().err}
        </div>
      </Show>
      <Show when={root()}>
        <div class="nd-layout">
          <div class="nd-tree-wrap">
            <div class="nd-tree">
              <Show when={root()} keyed>
                {(r) => <Node n={r} />}
              </Show>
            </div>
            <Show when={!tautology()}>
              <div class="msg warning sans" style={{ margin: '0.6rem' }}>
                <span class="msg-icon">!</span>
                <div class="msg-body">This formula is not even a classical tautology — it has no proof.</div>
              </div>
            </Show>
          </div>
          <div class="nd-side sans">
            <Show
              when={sel()}
              fallback={
                <div>
                  <Show when={complete()}>
                    <div class="nd-qed">
                      <span class="badge ok">∎ proof complete</span>
                      <Show when={kernelOk() !== undefined}>
                        <div style={{ 'margin-top': '0.5rem', 'font-size': '0.78rem' }}>
                          {kernelOk() ? '✓ the kernel accepts the proof term below as a proof of the theorem.' : '✗ the kernel rejected the term.'}
                        </div>
                      </Show>
                      <Show when={root() && ND.usesClassical(root()!)}>
                        <div style={{ 'margin-top': '0.5rem', 'font-size': '0.78rem' }}>This proof uses excluded middle, which has no computational content.</div>
                      </Show>
                    </div>
                  </Show>
                </div>
              }
            >
              <div class="label">goal</div>
              <div class="nd-goal">{ND.fstr(sel()!.goal)}</div>
              <div class="label" style={{ 'margin-top': '0.7rem' }}>
                hypotheses
              </div>
              <Show when={sel()!.ctx.length} fallback={<div class="muted" style={{ 'font-size': '0.8rem' }}>none</div>}>
                <For each={sel()!.ctx}>
                  {(h) => (
                    <button class="nd-hyp" onClick={() => useHyp(h)} title="use this hypothesis (applying it to further arguments if needed)">
                      <b>{h.name}</b> : {ND.fstr(h.f)}
                    </button>
                  )}
                </For>
              </Show>
              <div class="label" style={{ 'margin-top': '0.7rem' }}>
                rules
              </div>
              <div class="nd-rules">
                <For each={[...ND.applicable(sel()!), ...(classical() ? (['lem'] as ND.RuleId[]) : [])].filter((r) => r !== 'hyp')}>
                  {(r) => (
                    <button class={`btn small ${pending() === r ? 'active' : ''}`} onClick={() => apply(r)} title={`${ND.ruleInfo[r].name} — term: ${ND.ruleInfo[r].term}`}>
                      {ND.ruleInfo[r].label}
                    </button>
                  )}
                </For>
              </div>
              <Show when={pending()}>
                <div class="nd-aux">
                  <div style={{ 'font-size': '0.78rem', 'margin-bottom': '0.3rem' }}>
                    {pending() === 'impE' && 'From which A (proving both A → goal and A)?'}
                    {pending() === 'andE1' && 'The goal is the left half of which conjunction? Give the right half B.'}
                    {pending() === 'andE2' && 'The goal is the right half of which conjunction? Give the left half A.'}
                    {pending() === 'orE' && 'Which disjunction A ∨ B do you want to case-split on?'}
                    {pending() === 'lem' && 'Excluded middle for which proposition?'}
                  </div>
                  <div class="row">
                    <For each={suggestions(sel()!, pending()!)}>
                      {(f) => (
                        <button class="btn small" onClick={() => submitAux(f)}>
                          {ND.fstr(f)}
                        </button>
                      )}
                    </For>
                  </div>
                  <div class="row" style={{ 'margin-top': '0.3rem' }}>
                    <input class="input grow" placeholder="formula" value={auxSrc()} onInput={(e) => setAuxSrc(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && submitAux()} />
                    <button class="btn small primary" onClick={() => submitAux()}>
                      apply
                    </button>
                  </div>
                </div>
              </Show>
              <Show when={error()}>
                <div class="msg error" style={{ 'margin-top': '0.5rem' }}>
                  {error()}
                </div>
              </Show>
            </Show>
          </div>
        </div>
        <div class="nd-term">
          <span class="label">proof term</span>
          <div class="term">
            <For each={term()}>
              {(p) => (
                <span class={`${p.text.startsWith('?') ? 't-mvar' : ''} ${hoverNode() === p.node ? 'nd-term-hl' : ''}`} onMouseEnter={() => setHoverNode(p.node)} onMouseLeave={() => setHoverNode(undefined)}>
                  {p.text}
                </span>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
