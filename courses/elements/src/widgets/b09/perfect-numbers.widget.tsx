// ::perfect-numbers{n="5"}
// IX.36: choose n; if 2^n − 1 is prime, 2^(n−1)·(2^n − 1) is perfect. Lists the parts (proper
// divisors) of N = 2^(n−1)·(2^n − 1) in Euclid's two rows (the doubles of the unit, and the doubles
// of E = 2^n − 1) and adds them up. When 2^n − 1 is composite, shows how the sum misses N.

import { useMemo, useState } from 'react';
import { Widget } from '../shared/Widget';

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

function factor(n: number): number[] {
  const out: number[] = [];
  let m = n;
  for (let d = 2; d * d <= m; d++)
    while (m % d === 0) {
      out.push(d);
      m /= d;
    }
  if (m > 1) out.push(m);
  return out;
}

/** Divisors of n, ascending (n < 2^53, √n small enough to scan). */
function divisors(n: number): number[] {
  const lo: number[] = [];
  const hi: number[] = [];
  for (let d = 1; d * d <= n; d++)
    if (n % d === 0) {
      lo.push(d);
      if (d * d !== n) hi.unshift(n / d);
    }
  return [...lo, ...hi];
}

const fmt = (n: number) => n.toLocaleString('en-US');
const MAX = 20;

export default function PerfectNumbers(props: Record<string, string>) {
  const [n, setN] = useState(() => Math.min(MAX, Math.max(2, Number(props.n) || 5)));
  const e = 2 ** n - 1;
  const top = 2 ** (n - 1);
  const N = top * e;
  const prime = isPrime(e);
  const parts = useMemo(() => divisors(N).filter((d) => d < N), [N]);
  const sum = parts.reduce((s, d) => s + d, 0);
  const doubles = Array.from({ length: n }, (_, k) => 2 ** k); // 1, 2, …, 2^(n−1)
  const eDoubles = Array.from({ length: n - 1 }, (_, k) => e * 2 ** k); // E, 2E, …, 2^(n−2)E

  const chips = (xs: number[], colour: string) => (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
      {xs.map((x) => (
        <span key={x} style={{ border: `1px solid ${colour}`, color: colour, borderRadius: 10, padding: '0 7px', fontVariantNumeric: 'tabular-nums' }}>
          {fmt(x)}
        </span>
      ))}
    </span>
  );

  return (
    <Widget title="Perfect numbers from primes 2ⁿ − 1 (IX.36)">
      <div className="row">
        <label>
          <i>n</i>
          <input type="range" min={2} max={MAX} value={n} onChange={(ev) => setN(Number(ev.target.value))} />
          <span style={{ minWidth: '2em', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        </label>
        <span>
          1 + 2 + … + 2<sup>{n - 1}</sup> = 2<sup>{n}</sup> − 1 = <b>{fmt(e)}</b>{' '}
          {prime ? 'is prime' : `= ${factor(e).map(fmt).join(' · ')} is not prime`}
        </span>
      </div>
      <div style={{ lineHeight: 1.9, fontVariantNumeric: 'tabular-nums' }}>
        <div>
          <i>N</i> = 2<sup>{n - 1}</sup> · {fmt(e)} = <b>{fmt(N)}</b>
        </div>
        {prime ? (
          <>
            <div>
              <span style={{ color: 'var(--ink-2)' }}>Doubles of the unit: </span>
              {chips(doubles, 'var(--byrne-blue)')}
            </div>
            <div>
              <span style={{ color: 'var(--ink-2)' }}>Doubles of E = {fmt(e)}: </span>
              {chips(eDoubles, 'var(--byrne-red)')}
            </div>
            <div>
              These {parts.length} numbers are all the parts of <i>N</i>, and they add up to {fmt(sum)} = <i>N</i>. <b>{fmt(N)} is perfect.</b>
            </div>
          </>
        ) : (
          <div>
            <i>N</i> has {parts.length} parts{parts.length <= 40 ? <> ({parts.map(fmt).join(', ')})</> : null}, adding up to {fmt(sum)}, which is{' '}
            {sum > N ? 'more' : 'less'} than <i>N</i>. The hypothesis of IX.36 fails, and so does the conclusion.
          </div>
        )}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>
        2ⁿ − 1 can only be prime when n is prime, but n prime is not enough: 2¹¹ − 1 = 2047 = 23 · 89. The values of n up to {MAX} that give perfect numbers are 2, 3, 5, 7, 13, 17
        and 19.
      </p>
    </Widget>
  );
}
