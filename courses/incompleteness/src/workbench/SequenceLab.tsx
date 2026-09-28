// Sequence codes (section Sequences): the code ⟨a₀, …, a_k⟩ = p₀^{a₀+1} ⋯ p_k^{a_k+1}, len,
// (s)_i, append, concatenation and sequenceBound, computed; and decoding a number back into a
// sequence, or finding that it is not a code.

import { useMemo, useState } from 'react';
import { decodeSeq, encodeSeq } from '../engine/numbers/nat';
import { nthPrime } from '../engine/numbers/primes';
import { sequenceStore } from '../content/objects';
import { useStore } from '../ui/store';
import { Tex } from '../ui/Tex';
import { Prov } from '../ui/Prov';
import { Panel } from './coding';
import './recursion/sequence.css';

const MAX_LEN = 12;
const MAX_ELT = 400n;

function parseList(s: string): bigint[] | string {
  const t = s.trim().replace(/^[⟨<]\s*|\s*[⟩>]$/g, '');
  if (!t) return [];
  const parts = t.split(/[\s,]+/).filter(Boolean);
  if (!parts.every((p) => /^\d+$/.test(p))) return 'Write natural numbers separated by commas, e.g. 2, 7, 3.';
  const xs = parts.map(BigInt);
  if (xs.length > MAX_LEN) return `At most ${MAX_LEN} numbers here.`;
  if (xs.some((x) => x > MAX_ELT)) return `Keep each number at most ${MAX_ELT} here.`;
  return xs;
}

/** All digits when short, otherwise the first and last digits and the number of digits. */
function Digits({ n }: { n: bigint }) {
  const s = n.toString();
  if (s.length <= 60) return <span className="mono">{s}</span>;
  return (
    <span className="mono">
      {s.slice(0, 24)}…{s.slice(-12)} <span className="muted sans small">({s.length.toLocaleString('en-US')} digits)</span>
    </span>
  );
}

const seqTex = (xs: bigint[]) => (xs.length ? `\\langle ${xs.join(', ')} \\rangle` : '\\Lambda');

export function SequenceLab() {
  const text = useStore(sequenceStore);
  const xs = useMemo(() => parseList(text), [text]);
  const [extra, setExtra] = useState('5');
  const [tText, setTText] = useState('1, 0');
  const [nText, setNText] = useState('2250');
  const ok = typeof xs !== 'string';
  const code = ok ? encodeSeq(xs) : null;
  const a = /^\d+$/.test(extra.trim()) && BigInt(extra.trim()) <= MAX_ELT ? BigInt(extra.trim()) : null;
  const ts = parseList(tText);
  const nClean = nText.replace(/[\s,_]/g, '');
  const n = /^\d+$/.test(nClean) && nClean.length <= 60 ? BigInt(nClean) : null;
  const decoded = useMemo(() => (n === null ? null : decodeSeq(n)), [n]);
  const bound = useMemo(() => {
    if (!ok || xs.length === 0) return null;
    const x = xs.reduce((m, v) => (v > m ? v : m), 0n);
    const k = xs.length;
    return { x, k, value: BigInt(nthPrime(k - 1)) ** (BigInt(k) * (x + 1n)) };
  }, [ok, xs]);
  return (
    <div className="workbench">
      <Panel n={1} title="A sequence and its code" prov={<Prov kind="computed" />}>
        <label className="fi-label" htmlFor="seq-in">
          The sequence s (up to {MAX_LEN} numbers, each at most {String(MAX_ELT)})
        </label>
        <input id="seq-in" className="fi-field mono" value={text} onChange={(e) => sequenceStore.set(e.target.value)} spellCheck={false} aria-invalid={!ok} />
        {!ok ? (
          <p className="fi-error" role="alert">
            {xs}
          </p>
        ) : (
          <>
            <div className="seq-math">
              <Tex tex={`${seqTex(xs)} = ${xs.length ? xs.map((x, i) => `${nthPrime(i)}^{${x} + 1}`).join(' \\cdot ') : '0'}`} />
            </div>
            <p className="seq-code" aria-live="polite">
              <Digits n={code!} />
            </p>
            {xs.length === 0 && <p className="wb-note">The empty sequence: the book lets both 0 and 1 code it, and writes Λ for 0.</p>}
            <div className="seq-scroll">
              <table className="code-table">
                <tbody>
                  <tr>
                    <th scope="row">
                      <Tex tex="\mathrm{len}(s)" />
                    </th>
                    <td>{xs.length}</td>
                    <td className="muted small">
                      {xs.length ? (
                        <>
                          the primes dividing s are <Tex tex={`p_0, \\ldots, p_{${xs.length - 1}}`} />: <Tex tex={`p_{${xs.length - 1}} \\mid s`} /> and{' '}
                          <Tex tex={`p_{${xs.length}} \\nmid s`} />
                        </>
                      ) : (
                        'no prime divides the code'
                      )}
                    </td>
                  </tr>
                  {xs.map((x, i) => (
                    <tr key={i}>
                      <th scope="row">
                        <Tex tex={`(s)_{${i}}`} />
                      </th>
                      <td>{x.toString()}</td>
                      <td className="muted small">
                        <Tex tex={`p_{${i}}^{${x + 1n}} \\mid s`} /> but <Tex tex={`p_{${i}}^{${x + 2n}} \\nmid s`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bound && (
              <p className="small sans seq-gap">
                <Tex tex={`\\mathrm{sequenceBound}(${bound.x}, ${bound.k}) = p_{${bound.k - 1}}^{${bound.k} \\cdot (${bound.x} + 1)}`} /> — with {bound.x.toString()} the largest
                element and {bound.k} the length — is <Digits n={bound.value} />; the code s is {code! <= bound.value ? 'at most' : 'larger than'} this bound.
              </p>
            )}
          </>
        )}
      </Panel>

      {ok && (
        <Panel n={2} title="append and concatenation" prov={<Prov kind="computed" />}>
          <label className="args-input sans" htmlFor="seq-append">
            append <Tex tex="a =" />
          </label>{' '}
          <input id="seq-append" className="seq-small mono" value={extra} onChange={(e) => setExtra(e.target.value)} inputMode="numeric" spellCheck={false} aria-invalid={a === null} />
          {a === null ? (
            <p className="fi-error" role="alert">
              A natural number at most {String(MAX_ELT)}.
            </p>
          ) : (
            <div className="seq-math">
              <Tex
                tex={
                  xs.length === 0
                    ? `\\mathrm{append}(s, ${a}) = 2^{${a}+1} = \\langle ${a} \\rangle \\quad (s = 0 \\text{ or } 1)`
                    : `\\mathrm{append}(s, ${a}) = s \\cdot p_{\\mathrm{len}(s)}^{${a}+1} = s \\cdot ${nthPrime(xs.length)}^{${a + 1n}} = \\langle ${[...xs, a].join(', ')} \\rangle`
                }
              />
            </div>
          )}
          <label className="fi-label seq-gap" htmlFor="seq-t">
            A second sequence t
          </label>
          <input id="seq-t" className="fi-field mono" value={tText} onChange={(e) => setTText(e.target.value)} spellCheck={false} aria-invalid={typeof ts === 'string'} />
          {typeof ts === 'string' ? (
            <p className="fi-error" role="alert">
              {ts}
            </p>
          ) : (
            <>
              <div className="seq-math">
                <Tex tex={`s \\frown t = \\mathrm{hconcat}(s, t, \\mathrm{len}(t)) = ${seqTex([...xs, ...ts])}`} />
              </div>
              <p className="small sans">
                The helper appends the elements of t one at a time: <Tex tex="\mathrm{hconcat}(s, t, 0) = s" />,{' '}
                <Tex tex="\mathrm{hconcat}(s, t, n+1) = \mathrm{append}(\mathrm{hconcat}(s, t, n), (t)_n)" />. The code of <Tex tex="s \frown t" /> is{' '}
                <Digits n={encodeSeq([...xs, ...ts])} />.
              </p>
            </>
          )}
          <p className="muted sans small">
            Why the +1 in the exponents? Without it, ⟨2, 7, 3⟩ and ⟨2, 7, 3, 0, 0⟩ would have the same code: <Tex tex={`2^2 3^7 5^3 = 2^2 3^7 5^3 7^0 11^0`} />.
          </p>
        </Panel>
      )}

      <Panel n={3} title="From a number back to a sequence" prov={<Prov kind="computed" />}>
        <label className="fi-label" htmlFor="seq-n">
          A number (at most 60 digits)
        </label>
        <input id="seq-n" className="fi-field mono" value={nText} onChange={(e) => setNText(e.target.value)} inputMode="numeric" spellCheck={false} aria-invalid={n === null} />
        {n === null ? (
          <p className="fi-error" role="alert">
            Type a natural number with at most 60 digits.
          </p>
        ) : (
          decoded && (
            <div aria-live="polite">
              {decoded.steps.length > 0 && (
                <div className="seq-math">
                  <Tex tex={`${n} = ${decoded.steps.map((st) => `${st.p}^{${st.exponent}}`).join(' \\cdot ')}${decoded.ok ? '' : ' \\cdots'}`} />
                </div>
              )}
              {decoded.ok ? (
                <p className="sans">
                  It codes <Tex tex={seqTex(decoded.items)} />
                  {decoded.items.length > 0 && <> (each exponent minus one)</>}.
                </p>
              ) : (
                <p className="wb-note">
                  Not the code of a sequence: {decoded.reason}. Codes are divisible by an unbroken run of primes <Tex tex="p_0, p_1, \ldots" />; the functions len and{' '}
                  <Tex tex="(s)_i" /> still give some value on such a number, but it means nothing.
                </p>
              )}
            </div>
          )
        )}
        <p className="small sans muted">
          Decoding relies on the Fundamental Theorem of Arithmetic, as the text explains: a number has only one prime factorization, so it codes at most one sequence.
        </p>
      </Panel>
    </div>
  );
}
