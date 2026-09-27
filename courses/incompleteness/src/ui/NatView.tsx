// Displays an exact symbolic number without expanding it unless it is small enough.

import { useMemo, useState } from 'react';
import { digitCount, evaluate, formatMagnitude, magnitude, seqParts, toTex, type Nat } from '../engine/numbers/nat';
import { Tex } from './Tex';

export function NatView({ n, style = 'seq', maxItems = 10, expandable = true, className }: { n: Nat; style?: 'seq' | 'powers' | 'value'; maxItems?: number; expandable?: boolean; className?: string }) {
  const [digits, setDigits] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const exact = useMemo(() => evaluate(n, 256), [n]);
  const mag = useMemo(() => magnitude(n), [n]);
  const lower = useMemo(() => (mag ? null : magnitude(n, { lowerBound: true })), [n, mag]);
  const canExpand = expandable && mag && 'L' in mag && mag.L < 2_000_000;
  if (exact !== null && style === 'value') return <span className={`nat ${className ?? ''}`}>{exact.toLocaleString('en-US')}</span>;
  const tex = exact !== null && exact < 10n ** 30n && style !== 'powers' && !seqParts(n)?.length ? exact.toString() : toTex(n, { seqStyle: style === 'powers' ? 'powers' : 'seq', maxItems });
  return (
    <span className={`nat ${className ?? ''}`}>
      <Tex tex={tex} />
      <span className="nat-size">
        {mag ? formatMagnitude(mag) : lower ? `at least ${formatMagnitude(lower)} (part of it is known only by name)` : 'known only by name'}
        {mag && 'LL' in mag && ' — far too many to write down'}
      </span>
      {canExpand && digits === null && (
        <button
          className="chip-btn nat-expand"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setTimeout(() => {
              const v = evaluate(n, 1 << 23);
              setDigits(v === null ? 'too large' : v.toString());
              setBusy(false);
            }, 20);
          }}
        >
          {busy ? 'Computing…' : 'Show all digits'}
        </button>
      )}
      {digits !== null && <DigitBlock digits={digits} />}
    </span>
  );
}

function DigitBlock({ digits }: { digits: string }) {
  const [all, setAll] = useState(digits.length < 4000);
  const shown = all ? digits : `${digits.slice(0, 1500)} … ${digits.slice(-300)}`;
  return (
    <span className="digits mono">
      {shown}
      {!all && (
        <button className="chip-btn" onClick={() => setAll(true)}>
          all {digits.length.toLocaleString('en-US')} digits
        </button>
      )}
    </span>
  );
}

export function sizeText(n: Nat): string {
  const m = magnitude(n);
  if (m) return formatMagnitude(m);
  const d = digitCount(n);
  return d ? formatMagnitude(d) : 'unknown size';
}
