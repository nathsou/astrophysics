// ::prime-exponents{a="12" b="18" k="2"}
// Two numbers as vectors of prime exponents. a divides b exactly when every exponent of a is at
// most the matching exponent of b; raising both to the k-th power multiplies every exponent by k,
// which preserves each comparison in both directions. This is the modern reason behind VIII.14–17.

import { useState } from 'react';
import { Widget } from '../shared/Widget';

const MAX = 60;

function factor(n: number): Map<number, number> {
  const m = new Map<number, number>();
  for (let p = 2; p * p <= n; p++)
    while (n % p === 0) {
      m.set(p, (m.get(p) ?? 0) + 1);
      n /= p;
    }
  if (n > 1) m.set(n, (m.get(n) ?? 0) + 1);
  return m;
}

const show = (n: number, k: number) => (k === 1 ? `${n}` : `${n}${k === 2 ? '²' : '³'}`);

export default function PrimeExponents(props: Record<string, string>) {
  const clamp = (x: number, d: number) => Math.min(MAX, Math.max(2, Number.isFinite(x) && x > 0 ? x : d));
  const [a, setA] = useState(() => clamp(Number(props.a), 12));
  const [b, setB] = useState(() => clamp(Number(props.b), 18));
  const [k, setK] = useState(() => (props.k === '3' ? 3 : props.k === '1' ? 1 : 2));
  const fa = factor(a);
  const fb = factor(b);
  const primes = [...new Set([...fa.keys(), ...fb.keys()])].sort((x, y) => x - y);
  const divides = primes.every((p) => (fa.get(p) ?? 0) <= (fb.get(p) ?? 0));
  const cell: React.CSSProperties = { padding: '3px 10px', textAlign: 'center', borderBottom: '1px solid var(--rule)' };
  const bad: React.CSSProperties = { ...cell, color: 'var(--byrne-red)', fontWeight: 600 };
  const btn = (n: 1 | 2 | 3, label: string) => (
    <button className={`chip-btn ${k === n ? 'on' : ''}`} onClick={() => setK(n)}>
      {label}
    </button>
  );
  const pow = (x: number) => x ** k;
  return (
    <Widget title="Divisibility as exponents">
      <div className="row">
        <label>
          <i>a</i>
          <input type="range" min={2} max={MAX} value={a} onChange={(e) => setA(Number(e.target.value))} />
          <span style={{ minWidth: '2em', fontVariantNumeric: 'tabular-nums' }}>{a}</span>
        </label>
        <label>
          <i>b</i>
          <input type="range" min={2} max={MAX} value={b} onChange={(e) => setB(Number(e.target.value))} />
          <span style={{ minWidth: '2em', fontVariantNumeric: 'tabular-nums' }}>{b}</span>
        </label>
        <span style={{ flex: 1 }} />
        {btn(1, 'sides')}
        {btn(2, 'squares')}
        {btn(3, 'cubes')}
      </div>
      <table style={{ borderCollapse: 'collapse', margin: '8px 0', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            <th style={{ ...cell, textAlign: 'left' }}>prime</th>
            <th style={cell}>
              in {show(a, k)} = {pow(a)}
            </th>
            <th style={cell}>
              in {show(b, k)} = {pow(b)}
            </th>
            <th style={cell}>≤ ?</th>
          </tr>
        </thead>
        <tbody>
          {primes.map((p) => {
            const ea = (fa.get(p) ?? 0) * k;
            const eb = (fb.get(p) ?? 0) * k;
            const ok = ea <= eb;
            return (
              <tr key={p}>
                <td style={{ ...cell, textAlign: 'left' }}>{p}</td>
                <td style={ok ? cell : bad}>{ea}</td>
                <td style={cell}>{eb}</td>
                <td style={ok ? cell : bad}>{ok ? '✓' : '✗'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ margin: '4px 0 0' }}>
        {show(a, k)} {divides ? 'divides' : 'does not divide'} {show(b, k)}
        {k > 1 && (
          <>
            , and {a} {divides ? 'divides' : 'does not divide'} {b}
          </>
        )}
        .
      </p>
      <p className="note">
        Each column is a number written as its exponents over the primes. Divisibility compares the columns entry by entry. Squaring or cubing multiplies every entry by 2 or 3, which changes no
        comparison: the ✗ rows are the same for sides, squares and cubes.
      </p>
    </Widget>
  );
}
