// Pieces shared by the lambda-calculus workbenches: term input with parse errors, presets,
// a "send to the Lambda Lab" channel, TeX rendering and status lines.

import { useId, useMemo, type ReactNode } from 'react';
import { BOOK_DEFS, toTex, tryParseLambda, type LambdaParseResult, type LambdaPrintOptions, type Term } from '../../engine/lambda/lambda';
import { Store } from '../../ui/store';
import { Tex } from '../../ui/Tex';
import type { RunStatus } from '../../engine/lambda/lambda';
import './lambda.css';

// ------------------------------------------------------------------ presets

export interface Preset {
  src: string;
  label: string;
}

export const BOOK_EXAMPLES: Preset[] = [
  { src: '(λx.x x y) λz.z', label: '(λx.xxy)λz.z — reduction, example 1' },
  { src: '(λx.x x y) (λx.x x y)', label: '(λx.xxy)(λx.xxy) — it grows (example 2)' },
  { src: '(λx.x x) (λx.x x)', label: '(λx.xx)(λx.xx) — reduces to itself (example 3)' },
  { src: '(λx.(λy.y x) z) v', label: '(λx.(λy.yx)z)v — two ways (example 4)' },
  { src: '(λx.λy.x) y', label: '(λx.λy.x)y — a capture hazard' },
  { src: '(λx.λy.x) m n', label: '(λx.λy.x)MN — currying' },
  { src: 'K I Ω', label: 'K I Ω — the order of reduction matters' },
  { src: 'Succ 0', label: 'Succ 0̄ — the book’s example of the successor' },
  { src: 'Add 2 3', label: 'Add 2̄ 3̄' },
  { src: 'Mult 2 2', label: 'Mult 2̄ 2̄' },
  { src: 'Exp 2 2', label: 'Exp 2̄ 2̄' },
  { src: 'Pred 2', label: 'Pred 2̄' },
  { src: 'IsZero 0', label: 'IsZero 0̄' },
  { src: 'And True False', label: 'And true false' },
  { src: 'Fst ⟨m, n⟩', label: 'Fst ⟨M, N⟩' },
  { src: 'Y g', label: 'Y g — Turing’s fixpoint combinator' },
  { src: 'Y_C g', label: 'Y_C g — Church’s fixpoint combinator' },
  { src: 'Fac 1', label: 'Fac 1̄ — factorial via Y' },
];

export const NAMED_PRESETS: Preset[] = Object.entries(BOOK_DEFS)
  .filter(([k]) => k !== 'Omega')
  .map(([k, d]) => ({ src: k, label: `${d.label ?? k}${typeof d.src === 'string' ? ` ≡ ${d.src}` : ''}${k === "Mult'" || k === 'Search' ? ' (corrected)' : ''}` }));

// ------------------------------------------------------------------ send to the lab

/** A request to load a term into the Lambda Lab on this page. */
export const labRequest = new Store<{ src: string; n: number } | null>(null);
let nonce = 0;
export function sendToLab(src: string) {
  labRequest.set({ src, n: ++nonce });
  const el = typeof document !== 'undefined' ? document.getElementById('lambda-lab') : null;
  el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

export function SendToLab({ src, children }: { src: string; children?: ReactNode }) {
  return (
    <button type="button" className="chip-btn" onClick={() => sendToLab(src)} title="Load this term into the Lambda Lab on this page and step through it yourself">
      {children ?? 'Step through it in the Lambda Lab ↓'}
    </button>
  );
}

// ------------------------------------------------------------------ input

export function useParsedLambda(src: string, singleLetter = false): LambdaParseResult {
  return useMemo(() => tryParseLambda(src, { singleLetter, maxNumeral: 200 }), [src, singleLetter]);
}

export function ParseError({ src, r }: { src: string; r: LambdaParseResult }) {
  if (r.ok) return null;
  return (
    <div className="fi-error" role="alert">
      <span>{r.error}</span>
      <span className="fi-caret mono">
        {src.slice(0, r.pos)}
        <mark>{src.slice(r.pos, r.pos + 1) || ' '}</mark>
        {src.slice(r.pos + 1)}
      </span>
    </div>
  );
}

export function TermInput({
  value,
  onChange,
  label,
  presets,
  parsed,
  singleLetter,
  onSingleLetter,
}: {
  value: string;
  onChange: (s: string) => void;
  label: ReactNode;
  presets?: { group: string; items: Preset[] }[];
  parsed: LambdaParseResult;
  singleLetter?: boolean;
  onSingleLetter?: (b: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="lam-input">
      <label className="fi-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={`lam-field ${parsed.ok ? '' : 'invalid'}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        aria-invalid={!parsed.ok}
      />
      <div className="lam-row">
        {presets && (
          <select
            className="lam-select"
            aria-label="Choose an example"
            value=""
            onChange={(e) => {
              if (e.target.value) onChange(e.target.value);
            }}
          >
            <option value="">Examples and named terms…</option>
            {presets.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((p) => (
                  <option key={g.group + p.src} value={p.src}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
        {onSingleLetter && (
          <label title="In the book's notation every variable is a single letter, so λxy.xy means λx.λy.(x y)">
            <input type="checkbox" checked={!!singleLetter} onChange={(e) => onSingleLetter(e.target.checked)} /> single-letter variables (λfx.f(fx))
          </label>
        )}
      </div>
      <p className="wb-note">
        Write <code>λx.M</code> or <code>\x.M</code>, <code>λx y.M</code> for several binders; application is juxtaposition. Digits are Church numerals, <code>⟨M, N⟩</code> is a pair, and capitalised names (<code>Succ</code>, <code>K</code>, <code>Y</code>, <code>IsZero</code>, …) are the book’s terms.
      </p>
      <ParseError src={value} r={parsed} />
    </div>
  );
}

// ------------------------------------------------------------------ display

export function TermTex({ term, opts, display }: { term: Term; opts?: LambdaPrintOptions; display?: boolean }) {
  const tex = useMemo(() => toTex(term, opts), [term, opts]);
  if (tex.length > 6000) return <code className="mono small">{tex.slice(0, 200)}… (a very long term)</code>;
  return <Tex tex={tex} display={display} className="lam-tex" />;
}

export function statusClass(s: RunStatus | 'running' | 'info'): string {
  return s === 'normal-form' ? 'ok' : s === 'running' ? 'running' : s === 'info' ? '' : 'warn';
}

export const clampInt = (s: string, lo: number, hi: number, fallback: number): number => {
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
};

export const LABELS: LambdaPrintOptions = { labels: true, numerals: true };
export const PLAIN: LambdaPrintOptions = {};
