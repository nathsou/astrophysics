// Small shared pieces for the represent2 workbenches.

import { useState } from 'react';
import './represent2.css';

/** An exact bigint, abbreviated when long (with a button to show every digit). */
export function Big({ v, max = 40, label }: { v: bigint; max?: number; label?: string }) {
  const [all, setAll] = useState(false);
  const s = v.toString();
  if (s.length <= max || all) {
    return (
      <span className="r2-big" aria-label={label}>
        {s}
        {s.length > max && <span className="r2-digits">({s.length.toLocaleString('en-US')} digits)</span>}
      </span>
    );
  }
  return (
    <span className="r2-big" aria-label={label}>
      {s.slice(0, Math.ceil(max / 2))}…{s.slice(-8)}
      <span className="r2-digits">({s.length.toLocaleString('en-US')} digits)</span>
      <button className="chip-btn" onClick={() => setAll(true)}>
        all digits
      </button>
    </span>
  );
}

export function Mark({ ok, yes = '✓', no = '✗' }: { ok: boolean; yes?: string; no?: string }) {
  return (
    <span className={ok ? 'r2-ok' : 'r2-bad'} aria-label={ok ? 'holds' : 'fails'}>
      {ok ? yes : no}
    </span>
  );
}

/** Parses "2, 0, 3" into bigints, with limits. */
export function parseNumbers(s: string, maxCount: number, maxValue: bigint): { ok: true; xs: bigint[] } | { ok: false; error: string } {
  const parts = s.trim().split(/[\s,]+/).filter(Boolean);
  if (!parts.length) return { ok: false, error: 'Enter at least one number.' };
  if (!parts.every((p) => /^\d+$/.test(p))) return { ok: false, error: 'Use natural numbers separated by commas.' };
  if (parts.length > maxCount) return { ok: false, error: `At most ${maxCount} numbers here.` };
  const xs = parts.map((p) => BigInt(p));
  if (xs.some((x) => x > maxValue)) return { ok: false, error: `Each number at most ${maxValue} here (the codes grow quickly).` };
  return { ok: true, xs };
}

/** A natural number typed by the reader: digits, or a product of powers such as 2^10·3. */
export function parseNat(s: string, maxDigits = 5000): bigint | null {
  const t = s.replace(/[\s_]/g, '');
  if (!t) return null;
  if (/^\d+$/.test(t)) return t.length <= maxDigits ? BigInt(t) : null;
  let r = 1n;
  for (const f of t.split(/[·*×]/)) {
    const m = /^(\d+)(?:\^\{?(\d+)\}?)?$/.exec(f);
    if (!m) return null;
    const e = BigInt(m[2] ?? '1');
    if (e > 20_000n) return null;
    r *= BigInt(m[1]) ** e;
  }
  return r.toString().length <= maxDigits ? r : null;
}

/** Runs a slow computation after the next paint, reporting status. */
export function useDeferred<T>(): [T | null, boolean, (f: () => T) => void, () => void] {
  const [value, setValue] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const run = (f: () => T) => {
    setBusy(true);
    setTimeout(() => {
      setValue(f());
      setBusy(false);
    }, 30);
  };
  return [value, busy, run, () => setValue(null)];
}
