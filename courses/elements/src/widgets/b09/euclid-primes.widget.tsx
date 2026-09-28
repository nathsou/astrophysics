// ::euclid-primes{set="2,7"}
// IX.20 as a program: choose a finite list of primes, form their product P, add one, factor P + 1,
// and see the prime (or primes) it yields that are not in the list. "Add to the list" repeats the
// step with the new prime included. All arithmetic is exact: the product of the primes up to 41 is
// below 2^53.

import { useMemo, useState } from 'react';
import { Widget } from '../shared/Widget';

const CHOICES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];

/** Prime factors of n with multiplicity, by trial division (n < 2^53). */
export function factor(n: number): number[] {
  const out: number[] = [];
  let m = n;
  for (let d = 2; d * d <= m; d += d === 2 ? 1 : 2)
    while (m % d === 0) {
      out.push(d);
      m /= d;
    }
  if (m > 1) out.push(m);
  return out;
}

function parseSet(s: string | undefined): number[] {
  const xs = (s ?? '2,7')
    .split(/[,\s]+/)
    .map(Number)
    .filter((x) => CHOICES.includes(x));
  return xs.length ? [...new Set(xs)].sort((a, b) => a - b) : [2, 7];
}

const fmt = (n: number) => n.toLocaleString('en-US');

export default function EuclidPrimes(props: Record<string, string>) {
  const [set, setSet] = useState<number[]>(() => parseSet(props.set));
  const [extra, setExtra] = useState<number[]>([]); // primes found and added, beyond the chips

  const list = useMemo(() => [...set, ...extra].sort((a, b) => a - b), [set, extra]);
  const product = list.reduce((p, x) => p * x, 1);
  const safe = Number.isSafeInteger(product + 1);
  const n = product + 1;
  const fs = useMemo(() => (safe && list.length ? factor(n) : []), [n, safe, list.length]);
  const distinct = [...new Set(fs)];
  const isPrime = fs.length === 1;
  const least = fs[0];

  const toggle = (p: number) => setSet((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p].sort((a, b) => a - b)));
  const addNew = () => {
    if (!least) return;
    if (CHOICES.includes(least)) setSet((s) => [...s, least].sort((a, b) => a - b));
    else setExtra((e) => [...e, least]);
  };
  const reset = (xs: number[]) => {
    setSet(xs);
    setExtra([]);
  };

  const chip = (label: string, on: () => void, active = false, disabled = false) => (
    <button key={label} className={`chip-btn ${active ? 'on' : ''}`} onClick={on} disabled={disabled} style={disabled ? { opacity: 0.45, cursor: 'default' } : undefined}>
      {label}
    </button>
  );

  return (
    <Widget title="New primes from old (IX.20)">
      <div className="row">
        <span style={{ color: 'var(--ink-2)' }}>The given primes:</span>
        {CHOICES.map((p) => chip(String(p), () => toggle(p), set.includes(p)))}
      </div>
      {extra.length > 0 && (
        <div className="row">
          <span style={{ color: 'var(--ink-2)' }}>Found and added:</span>
          {extra.map((p) => (
            <span key={p} className="chip-btn on" style={{ cursor: 'default' }}>
              {p}
            </span>
          ))}
        </div>
      )}
      <div className="row">
        {chip('2, 7', () => reset([2, 7]))}
        {chip('2, 3, 5', () => reset([2, 3, 5]))}
        {chip('2, 3, 5, 7, 11, 13', () => reset([2, 3, 5, 7, 11, 13]))}
        {chip('3, 5, 7', () => reset([3, 5, 7]))}
        <span style={{ flex: 1 }} />
        {chip('Add the new prime to the list', addNew, false, !least || !safe || !Number.isSafeInteger(product * least + 1))}
      </div>
      {list.length === 0 ? (
        <p style={{ margin: '8px 0 0', color: 'var(--ink-2)' }}>Choose at least one prime.</p>
      ) : !safe ? (
        <p style={{ margin: '8px 0 0', color: 'var(--ink-2)' }}>The product is too large to factor here. Reset the list.</p>
      ) : (
        <div style={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.7, marginTop: 6 }}>
          <div>
            <i>P</i> = {list.join(' · ')} = <b>{fmt(product)}</b>
          </div>
          <div>
            <i>P</i> + 1 = <b>{fmt(n)}</b>
            {isPrime ? ' is prime.' : ` = ${fs.map(fmt).join(' · ')}`}
          </div>
          <div style={{ marginTop: 4 }}>
            {isPrime ? (
              <>
                First case: <i>P</i> + 1 is itself a prime not in the list.
              </>
            ) : (
              <>
                Second case: <i>P</i> + 1 is composite. Its least prime factor <b>{least}</b> is not in the list
                {distinct.length > 1 ? <> (nor are its other prime factors, {distinct.slice(1).map(fmt).join(', ')})</> : null}.
              </>
            )}{' '}
            Every prime in the list leaves remainder 1 when it divides <i>P</i> + 1:{' '}
            {list
              .slice(0, 8)
              .map((p) => `${fmt(n)} mod ${p} = ${n % p}`)
              .join(', ')}
            {list.length > 8 ? ', …' : ''}.
          </div>
        </div>
      )}
      <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>
        Euclid does not speak of the product: he takes the least number the primes measure, which for distinct primes is the product. The new prime is usually not the next prime
        after the list ({'{'}3, 5, 7{'}'} gives 106 = 2 · 53), and P + 1 is often prime for small lists, but not always: 2 · 3 · 5 · 7 · 11 · 13 + 1 = 30031 = 59 · 509.
      </p>
    </Widget>
  );
}
