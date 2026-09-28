// ::constructible{max="100"}: which regular polygons can be constructed with straightedge and
// compass (Gauss–Wantzel: n = 2^k · distinct Fermat primes), and which of them Euclid's own
// methods reach (triangle, square, pentagon, 15-gon, and doubling by bisection).
import { useState } from 'react';
import { Widget } from '../shared/Widget';

const FERMAT = [3, 5, 17, 257, 65537];

function analyse(n: number): { k: number; primes: number[]; rest: number } {
  let m = n;
  let k = 0;
  while (m % 2 === 0) {
    m /= 2;
    k++;
  }
  const primes: number[] = [];
  for (const p of FERMAT) if (m % p === 0) {
    m /= p;
    primes.push(p);
  }
  return { k, primes, rest: m };
}

function primeFactors(n: number): string[] {
  const out: string[] = [];
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    let e = 0;
    while (m % p === 0) {
      m /= p;
      e++;
    }
    if (e) out.push(e > 1 ? `${p}^${e}` : String(p));
  }
  if (m > 1) out.push(String(m));
  return out;
}

type Status = 'euclid' | 'gauss' | 'no';

function status(n: number): Status {
  const { primes, rest } = analyse(n);
  if (rest !== 1) return 'no';
  return primes.every((p) => p === 3 || p === 5) ? 'euclid' : 'gauss';
}

const COLOURS: Record<Status, string> = { euclid: 'var(--byrne-blue)', gauss: 'var(--byrne-red)', no: 'var(--rule)' };

export default function Constructible({ max = '100' }: Record<string, string>) {
  const N = Math.max(20, Math.min(300, Number(max) || 100));
  const [sel, setSel] = useState(17);
  const cols = 10;
  const cell = 34;
  const ns = Array.from({ length: N - 2 }, (_, i) => i + 3);
  const rows = Math.ceil(ns.length / cols);
  const a = analyse(sel);
  const st = status(sel);
  const factors = primeFactors(sel);
  return (
    <Widget
      title="Constructible regular polygons"
      note="Blue: reachable with Euclid's constructions (IV.6, IV.11, IV.15, IV.16) and repeated bisection. Red: constructible, but only by Gauss's method. Grey: not constructible with straightedge and compass (Wantzel)."
    >
      <svg viewBox={`0 0 ${cols * cell} ${rows * cell}`} role="img" aria-label="Regular n-gons from 3 up">
        {ns.map((n, i) => {
          const x = (i % cols) * cell;
          const y = Math.floor(i / cols) * cell;
          const s = status(n);
          return (
            <g key={n} onClick={() => setSel(n)} style={{ cursor: 'pointer' }}>
              <rect x={x + 2} y={y + 2} width={cell - 4} height={cell - 4} rx={4} style={{ fill: s === 'no' ? 'transparent' : COLOURS[s], opacity: s === 'no' ? 1 : 0.85, stroke: n === sel ? 'var(--ink)' : COLOURS[s], strokeWidth: n === sel ? 2 : 1 }} />
              <text x={x + cell / 2} y={y + cell / 2} dy="0.35em" textAnchor="middle" style={{ fontSize: 12, fill: s === 'no' ? 'var(--muted)' : '#fff' }}>
                {n}
              </text>
            </g>
          );
        })}
      </svg>
      <p>
        <strong>{sel}</strong> {factors.length === 1 && !factors[0].includes('^') ? 'is prime' : `= ${factors.join(' · ')}`}.{' '}
        {st === 'euclid' && 'Constructible with the tools of Book IV.'}
        {st === 'gauss' && `Constructible, because ${a.primes.filter((p) => p > 5).join(' and ')} ${a.primes.filter((p) => p > 5).length > 1 ? 'are Fermat primes' : 'is a Fermat prime'}; Euclid had no way to do it.`}
        {st === 'no' && 'Not constructible: its odd part is not a product of distinct Fermat primes.'}
      </p>
    </Widget>
  );
}
