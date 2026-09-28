// ::mean-proportionals{a="16" b="54" n="2"}
// How many mean proportionals can be put between two numbers (VIII.8–10, VIII.18–21)? Reduce
// a : b to least terms p : q; n means fit exactly when p and q are both (n+1)-th powers, and then
// the continued proportion is a multiple of the least one, x^(n+1), x^n·y, …, y^(n+1).

import { useState } from 'react';
import { Widget } from '../shared/Widget';

const MAX = 500;
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function root(n: number, e: number): number | null {
  const r = Math.round(n ** (1 / e));
  for (const c of [r - 1, r, r + 1]) if (c >= 1 && c ** e === n) return c;
  return null;
}

export default function MeanProportionals(props: Record<string, string>) {
  const init = (x: string | undefined, d: number) => Math.min(MAX, Math.max(1, Number(x) || d));
  const [a, setA] = useState(() => init(props.a, 16));
  const [b, setB] = useState(() => init(props.b, 54));
  const [n, setN] = useState(() => Math.min(4, Math.max(1, Number(props.n) || 2)));
  const d = gcd(a, b);
  const [p, q] = [a / d, b / d];
  const x = root(p, n + 1);
  const y = root(q, n + 1);
  const ok = x !== null && y !== null;
  const least = ok ? Array.from({ length: n + 2 }, (_, i) => x ** (n + 1 - i) * y ** i) : [];
  const m = ok ? a / least[0] : 0;
  const terms = least.map((t) => t * m);
  // the largest number of means that fit
  let most = 0;
  for (let j = 1; j <= 12; j++) if (root(p, j + 1) !== null && root(q, j + 1) !== null) most = j;
  const num = (label: string, v: number, set: (v: number) => void) => (
    <label>
      <i>{label}</i>
      <input type="number" min={1} max={MAX} value={v} onChange={(e) => set(Math.min(MAX, Math.max(1, Number(e.target.value) || 1)))} style={{ width: '5em' }} />
    </label>
  );
  return (
    <Widget title="Mean proportionals between two numbers">
      <div className="row">
        {num('a', a, setA)}
        {num('b', b, setB)}
        <label>
          means
          <input type="range" min={1} max={4} value={n} onChange={(e) => setN(Number(e.target.value))} />
          <span>{n}</span>
        </label>
      </div>
      <p style={{ margin: '6px 0' }}>
        In least terms, {a} : {b} = {p} : {q}. For {n} mean{n > 1 ? 's' : ''}, both must be {n === 1 ? 'squares' : n === 2 ? 'cubes' : `${n + 1}-th powers`}:{' '}
        {x !== null ? `${p} = ${x}${n === 1 ? '²' : n === 2 ? '³' : `^${n + 1}`}` : `${p} is not`}, {y !== null ? `${q} = ${y}${n === 1 ? '²' : n === 2 ? '³' : `^${n + 1}`}` : `${q} is not`}.
      </p>
      <p style={{ margin: '6px 0', fontVariantNumeric: 'tabular-nums' }}>
        {ok ? (
          <>
            <b>{terms.join(', ')}</b> is a continued proportion in the ratio {x} : {y} ({m} times the least one, {least.join(', ')}).
          </>
        ) : (
          <>
            No {n} mean{n > 1 ? 's' : ''} in whole numbers fall between {a} and {b}.
          </>
        )}
      </p>
      <p className="note">
        The most means that fit between {a} and {b}: {most === 12 ? '12 or more' : most}. The ratio in least terms decides everything (VIII.8): multiplying both numbers by the same factor changes
        nothing.
      </p>
    </Widget>
  );
}
