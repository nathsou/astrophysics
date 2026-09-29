// Text rendering of untyped λ-terms with redex highlighting.

import { For, createMemo } from 'solid-js';
import { type Path, type U, type Redex, printTokens, at } from '@kernel/untyped/lambda.ts';

export interface UTermViewProps {
  term: U;
  next?: Redex;
  redexes?: Redex[];
  onRedexClick?: (r: Redex) => void;
  recognise?: boolean;
  compact?: boolean;
  /** ids of nodes that were just substituted in */
  fresh?: Set<number>;
  class?: string;
}

const isPrefix = (p: Path, q: Path) => p.length <= q.length && p.every((x, i) => x === q[i]);

export function UTermView(props: UTermViewProps) {
  const toks = createMemo(() => printTokens(props.term, { recognise: props.recognise, compact: props.compact ?? true }));
  // for each token decide: in next redex? in next redex's function / argument? clickable redex
  const nextArgPath = () => (props.next?.kind === 'beta' ? [...props.next.path, 1] : undefined);
  const classify = (p: Path | undefined) => {
    if (!p) return '';
    const cls: string[] = [];
    const n = props.next;
    if (n && isPrefix(n.path, p)) {
      cls.push('u-redex');
      const ap = nextArgPath();
      if (ap && isPrefix(ap, p)) cls.push('u-arg');
      if (n.kind === 'beta' && p.length === n.path.length + 1 && p[n.path.length] === 0) cls.push('u-fun');
    }
    return cls.join(' ');
  };
  const redexAt = (p: Path | undefined): Redex | undefined => {
    if (!p || !props.redexes) return undefined;
    // the innermost redex whose root is a prefix of p and whose root token is the λ of the function or the def
    let best: Redex | undefined;
    for (const r of props.redexes) {
      if (!isPrefix(r.path, p)) continue;
      if (!best || r.path.length > best.path.length) best = r;
    }
    return best;
  };
  return (
    <span class={`uterm ${props.class ?? ''}`}>
      <For each={toks()}>
        {(t) => {
          const base = classify(t.path);
          const isLam = t.role === 'lambda' || t.role === 'binder';
          // a λ (or δ name) that heads a redex is clickable
          const clickR = () => {
            if (!t.path || !props.redexes) return undefined;
            if (t.role === 'def') return props.redexes.find((r) => r.kind === 'delta' && r.path.join() === t.path!.join());
            if (!isLam) return undefined;
            // λ at path p is the function of a redex at p minus last element (if last is 0)
            const p = t.path;
            if (p.length === 0 || p[p.length - 1] !== 0) return undefined;
            const rp = p.slice(0, -1);
            const r = props.redexes.find((r) => r.kind === 'beta' && r.path.join() === rp.join());
            return r;
          };
          const r = clickR();
          void redexAt;
          const fresh = t.id !== undefined && props.fresh?.has(t.id);
          return (
            <span
              class={`u-${t.role ?? 'x'} ${base} ${r ? 'u-clickable' : ''} ${fresh ? 'u-fresh' : ''}`}
              onClick={r ? () => props.onRedexClick?.(r) : undefined}
              title={r ? (r.kind === 'beta' ? 'click to contract this β-redex' : 'click to unfold this definition') : undefined}
            >
              {t.text}
            </span>
          );
        }}
      </For>
    </span>
  );
}

export { at };
