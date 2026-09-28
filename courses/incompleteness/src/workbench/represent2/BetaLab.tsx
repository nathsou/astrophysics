// The β-function lemma (section "The Beta Function Lemma"): the construction of a code d for a
// sequence a₀, …, aₙ — j, d₁, the moduli, their relative primality, Sunzi's theorem step by step,
// d₀ and d = J(d₀, d₁) — and decoding β(d, i). All numbers exact (bigint).

import { useMemo, useState } from 'react';
import { beta, betaTrace, encodeWithBeta, leastBetaCode, unpair, type BetaEncoding } from '../../engine/computability/beta';
import { encodeSeq } from '../../engine/numbers/nat';
import { nthPrime } from '../../engine/numbers/primes';
import { sequenceStore } from '../../content/objects';
import { useStore } from '../../ui/store';
import { Tex } from '../../ui/Tex';
import { NotAProof, Prov } from '../../ui/Prov';
import { Stepper } from '../../ui/Stepper';
import { Ref } from '../../formal/FormalText';
import { Panel } from '../coding';
import { Big, Mark, parseNat, parseNumbers, useDeferred } from './common';

const MAX_COUNT = 12;
const MAX_VALUE = 400n;

export function useBetaEncoding(rule: 'lcm' | 'factorial' = 'lcm') {
  const text = useStore(sequenceStore);
  const parsed = useMemo(() => parseNumbers(text, MAX_COUNT, MAX_VALUE), [text]);
  const enc = useMemo(() => (parsed.ok ? encodeWithBeta(parsed.xs, { d1Rule: rule }) : null), [parsed, rule]);
  return { text, parsed, enc };
}

export function BetaLab() {
  const [rule, setRule] = useState<'lcm' | 'factorial'>('lcm');
  const { text, parsed, enc } = useBetaEncoding(rule);
  return (
    <div className="workbench">
      <Panel n={1} title="A sequence a₀, …, aₙ" prov={<Prov kind="computed" />}>
        <div className="r2-row">
          <label htmlFor="r2-beta-seq" className="fi-label" style={{ margin: 0 }}>
            Sequence
          </label>
          <input id="r2-beta-seq" className={`r2-input wide ${parsed.ok ? '' : 'invalid'}`} value={text} onChange={(e) => sequenceStore.set(e.target.value)} aria-describedby="r2-beta-seq-help" />
        </div>
        <p id="r2-beta-seq-help" className="wb-note">
          Up to {MAX_COUNT} numbers, each at most {MAX_VALUE.toString()}. This is the same sequence as in the section on sequence codes, so you can compare the two codings.
        </p>
        {!parsed.ok && <p className="r2-err">{parsed.error}</p>}
        <div className="seg" role="radiogroup" aria-label="Choice of d₁">
          <button className="chip-btn" role="radio" aria-checked={rule === 'lcm'} onClick={() => setRule('lcm')}>
            d₁ = lcm(1, …, j) (the book)
          </button>
          <button className="chip-btn" role="radio" aria-checked={rule === 'factorial'} onClick={() => setRule('factorial')}>
            d₁ = j! (Gödel’s original)
          </button>
        </div>
        {enc && parsed.ok && (
          <p className="wb-note">
            For comparison, the prime-power code of the same sequence is <Tex tex={`\\langle ${parsed.xs.join(', ')}\\rangle = ${parsed.xs.map((x, i) => `${nthPrime(i)}^{${x + 1n}}`).join(' \\cdot ')}`} />, which has{' '}
            {encodeSeq(parsed.xs).toString().length.toLocaleString('en-US')} digits. The β-coding below uses only addition, multiplication and remainders: no exponentiation.
          </p>
        )}
      </Panel>
      {enc && <Moduli enc={enc} />}
      {enc && <Sunzi enc={enc} />}
      {enc && <Decoding enc={enc} />}
      {enc && <TryD enc={enc} />}
    </div>
  );
}

function Moduli({ enc }: { enc: BetaEncoding }) {
  const n = enc.n;
  return (
    <Panel n={2} title="j, d₁ and the moduli" prov={<Prov kind="computed" />}>
      <dl className="r2-kv">
        <dt>
          <Tex tex="n" />
        </dt>
        <dd>{n} (the sequence has n + 1 = {n + 1} elements)</dd>
        <dt>
          <Tex tex="j" />
        </dt>
        <dd>
          <Tex tex={`\\max(n, a_0 + 1, \\ldots, a_n + 1) = ${enc.j}`} />
        </dd>
        <dt>
          <Tex tex="d_1" />
        </dt>
        <dd>
          <Tex tex={enc.d1Rule === 'lcm' ? `\\mathrm{lcm}(1, \\ldots, ${enc.j}) =` : `${enc.j}! =`} /> <Big v={enc.d1} />
        </dd>
      </dl>
      <div className="r2-table-wrap">
        <table className="r2-table">
          <caption className="sr-only">The moduli x_i = 1 + (i+1)·d₁ and the check a_i &lt; x_i</caption>
          <thead>
            <tr>
              <th scope="col">i</th>
              <th scope="col">
                <Tex tex="a_i" />
              </th>
              <th scope="col">
                <Tex tex="x_i = 1 + (i+1)\,d_1" />
              </th>
              <th scope="col">
                <Tex tex="a_i < x_i" />
              </th>
            </tr>
          </thead>
          <tbody>
            {enc.bounds.map((b) => (
              <tr key={b.i}>
                <td>{b.i}</td>
                <td className="num">{b.a.toString()}</td>
                <td className="num">
                  <Big v={b.x} max={30} />
                </td>
                <td>
                  <Mark ok={b.ok} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {enc.moduli.length > 1 && (
        <>
          <p className="wb-note">
            Pairwise greatest common divisors <Tex tex="\gcd(x_i, x_k)" /> — all 1, as claim <Ref k="inc:req:bet:rel-prime" /> of the book’s argument says they must be: a prime dividing two of them would divide <Tex tex="(i-k)\,d_1" /> but not <Tex tex="d_1" />, and every number up to <Tex tex="j \ge n" /> divides <Tex tex="d_1" />.
          </p>
          <div className="r2-table-wrap">
            <table className="r2-table r2-gcd">
              <caption className="sr-only">Pairwise greatest common divisors of the moduli</caption>
              <thead>
                <tr>
                  <th scope="col">gcd</th>
                  {enc.moduli.map((_, k) => (
                    <th key={k} scope="col">
                      <Tex tex={`x_{${k}}`} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enc.moduli.map((_, i) => (
                  <tr key={i}>
                    <th scope="row">
                      <Tex tex={`x_{${i}}`} />
                    </th>
                    {enc.moduli.map((_, k) => {
                      if (i === k) return <td key={k} className="diag">·</td>;
                      const p = enc.pairs.find((q) => (q.i === Math.min(i, k) && q.k === Math.max(i, k)))!;
                      return (
                        <td key={k} className={p.gcd === 1n ? 'one' : 'bad'}>
                          {p.gcd.toString()}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="wb-note">
        Pairwise relatively prime: <Mark ok={enc.pairwiseCoprime} /> · every <Tex tex="a_i < x_i" />: <Mark ok={enc.bounds.every((b) => b.ok)} />
      </p>
    </Panel>
  );
}

function Sunzi({ enc }: { enc: BetaEncoding }) {
  const [step, setStep] = useState(0);
  const i = Math.min(step, enc.crt.length - 1);
  const s = enc.crt[i];
  return (
    <Panel n={3} title="Sunzi’s theorem, one congruence at a time" prov={<Prov kind="computed" />}>
      <p className="wb-note">
        The book only needs that some <Tex tex="d_0" /> with <Tex tex="d_0 \equiv a_i \pmod{x_i}" /> for every <Tex tex="i" /> exists. Here is one way to find it: keep a number <Tex tex="s" /> that satisfies the congruences so far, and add a multiple of the product <Tex tex="M" /> of the moduli used so far (which does not disturb them) to satisfy the next one.
      </p>
      <Stepper
        step={i}
        count={enc.crt.length}
        onStep={setStep}
        label="congruence"
        describe={(k) => {
          const c = enc.crt[k];
          return (
            <>
              Congruence {k}: make <Tex tex={`s \\equiv ${c.target} \\pmod{x_{${k}}}`} /> while keeping the previous ones.
            </>
          );
        }}
      />
      <dl className="r2-kv">
        <dt>so far</dt>
        <dd>
          <Tex tex={`s = `} /> <Big v={s.before.s} max={30} />, satisfying the congruences for <Tex tex={i === 0 ? '\\text{none yet}' : `i < ${i}`} />; <Tex tex="M =" /> <Big v={s.before.M} max={30} />
        </dd>
        <dt>choose t</dt>
        <dd>
          <Tex tex={`t = `} /> <Big v={s.t} max={30} /> so that <Tex tex={`s + t\\cdot M \\equiv a_{${i}} = ${s.target} \\pmod{x_{${i}}}`} /> (<Tex tex="t" /> exists because <Tex tex={`M`} /> and <Tex tex={`x_{${i}}`} /> are relatively prime)
        </dd>
        <dt>new s</dt>
        <dd>
          <Big v={s.after.s} max={30} /> <span className="r2-muted r2-small">≡ {s.target.toString()} mod x{i}: </span>
          <Mark ok={s.after.s % s.modulus === s.target} />
        </dd>
      </dl>
      <p className="wb-note">
        After the last step, <Tex tex="d_0" /> = <Big v={enc.d0} max={30} /> is the least number satisfying all {enc.crt.length} congruences.
      </p>
    </Panel>
  );
}

function Decoding({ enc }: { enc: BetaEncoding }) {
  const extra = 2;
  const rows = Array.from({ length: enc.seq.length + extra }, (_, i) => betaTrace(enc.d, i));
  return (
    <Panel n={4} title="d = J(d₀, d₁), and decoding with β" prov={<Prov kind="computed" />}>
      <div className="r2-eqs">
        <Tex tex={`J(x, y) = \\tfrac12[(x+y)(x+y+1)] + x`} />
        <Tex tex={`\\beta^*(d_0, d_1, i) = \\mathrm{rem}(1 + (i+1)\\,d_1,\\ d_0)`} />
        <Tex tex={`\\beta(d, i) = \\beta^*(K(d), L(d), i)`} />
      </div>
      <dl className="r2-kv">
        <dt>
          <Tex tex="d" />
        </dt>
        <dd>
          <Tex tex="J(d_0, d_1) =" /> <Big v={enc.d} />
        </dd>
        <dt>
          <Tex tex="K(d),\ L(d)" />
        </dt>
        <dd>
          recover <Tex tex="d_0" /> and <Tex tex="d_1" />: <Mark ok={unpair(enc.d).x === enc.d0 && unpair(enc.d).y === enc.d1} />
        </dd>
      </dl>
      <div className="r2-table-wrap">
        <table className="r2-table">
          <caption className="sr-only">Decoding: beta of d and i for each i</caption>
          <thead>
            <tr>
              <th scope="col">i</th>
              <th scope="col">
                <Tex tex="1 + (i+1)\,L(d)" />
              </th>
              <th scope="col">
                <Tex tex="\beta(d, i)" />
              </th>
              <th scope="col">
                <Tex tex="a_i" />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const inSeq = i < enc.seq.length;
              return (
                <tr key={i} className={inSeq ? '' : 'r2-dim'}>
                  <td>{i}</td>
                  <td className="num">
                    <Big v={r.modulus} max={24} />
                  </td>
                  <td className="num">
                    <Big v={r.value} max={24} />
                  </td>
                  <td>
                    {inSeq ? (
                      <>
                        {enc.seq[i].toString()} <Mark ok={r.value === enc.seq[i]} />
                      </>
                    ) : (
                      <span className="r2-muted r2-small">i &gt; n: not constrained</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="wb-note">
        For <Tex tex="i \le n" />, <Tex tex="\beta(d, i) = a_i" /> because <Tex tex="d_0 \equiv a_i" /> modulo <Tex tex="x_i" /> and <Tex tex="a_i < x_i" />. The last rows show that <Tex tex="\beta(d, i)" /> for <Tex tex="i > n" /> is just some number: the lemma says nothing about it, and nothing in the coding records the length <Tex tex="n + 1" />.
      </p>
      <NotAProof>
        These tables check the construction for your sequence. <Ref k="inc:req:bet:lem:beta" /> is proved for every sequence by the argument in the text; the table only confirms that each step of it did what it should here.
      </NotAProof>
    </Panel>
  );
}

function TryD({ enc }: { enc: BetaEncoding }) {
  const [text, setText] = useState('');
  const d = parseNat(text);
  const [least, busy, run, reset] = useDeferred<ReturnType<typeof leastBetaCode>>();
  const [limitIdx, setLimitIdx] = useState(1);
  const limits = [10_000n, 100_000n, 1_000_000n];
  const key = enc.seq.join(',');
  const [leastFor, setLeastFor] = useState('');
  return (
    <Panel n={5} title="Other codes for the same sequence" prov={<Prov kind="computed" />}>
      <p className="wb-note">
        Many numbers code the same sequence. Enter any <Tex tex="d" /> (digits, or a product like <code>2^10·3</code>) and see what it codes.
      </p>
      <div className="r2-row">
        <label>
          <Tex tex="d =" />
          <input className={`r2-input wide ${text && d === null ? 'invalid' : ''}`} value={text} onChange={(e) => setText(e.target.value)} placeholder={enc.d.toString().length < 30 ? enc.d.toString() : 'e.g. 1234'} aria-label="a number d" />
        </label>
      </div>
      {text && d === null && <p className="r2-err">Not a number this workbench accepts (at most 5,000 digits).</p>}
      {d !== null && (
        <div aria-live="polite">
          <p className="wb-note">
            <Tex tex="K(d) =" /> <Big v={unpair(d).x} max={24} />, <Tex tex="L(d) =" /> <Big v={unpair(d).y} max={24} />. Then{' '}
            <Tex tex={`\\beta(d, 0), \\ldots, \\beta(d, ${enc.n}) =`} />{' '}
            <span className="mono">{enc.seq.map((_, i) => beta(d, i).toString()).map((s) => (s.length > 12 ? `${s.slice(0, 6)}…` : s)).join(', ')}</span>
            {' — '}
            {enc.seq.every((a, i) => beta(d, i) === a) ? <span className="r2-ok">this d codes your sequence too.</span> : <span className="r2-bad">not your sequence.</span>}
          </p>
        </div>
      )}
      <p className="wb-note">
        The construction gives some code, usually a large one. In <Ref k="inc:req:pri:sec" />, <Tex tex="\hat h" /> is defined by <em>minimization</em>, which returns the <em>least</em> code. Search for it:
      </p>
      <div className="r2-row">
        <span className="seg" role="radiogroup" aria-label="Search limit" style={{ margin: 0 }}>
          {limits.map((l, i) => (
            <button key={i} className="chip-btn" role="radio" aria-checked={limitIdx === i} onClick={() => setLimitIdx(i)}>
              below {l.toLocaleString('en-US')}
            </button>
          ))}
        </span>
        <button
          className="chip-btn primary"
          disabled={busy}
          onClick={() => {
            reset();
            setLeastFor(key);
            run(() => leastBetaCode(enc.seq, limits[limitIdx]));
          }}
        >
          {busy ? 'Searching…' : 'Search d = 0, 1, 2, …'}
        </button>
      </div>
      <div aria-live="polite">
        {least && leastFor === key && (
          <p className="wb-note">
            {least.found ? (
              <>
                The least code is <b className="mono">{least.d.toString()}</b>
                {least.d === enc.d ? ' — the one the construction found.' : <> — the construction found a larger one ({enc.d.toString().length} digits).</>}
              </>
            ) : (
              <>
                No code below {least.searchedBelow.toLocaleString('en-US')}. That only means the least code is at least {least.searchedBelow.toLocaleString('en-US')}; it is at most the constructed <Tex tex="d" />.
              </>
            )}
          </p>
        )}
      </div>
    </Panel>
  );
}

/** A compact version of the construction (for Formal mode). */
export function BetaSummary() {
  const { text, parsed, enc } = useBetaEncoding('lcm');
  if (!parsed.ok || !enc) return <p className="r2-err">Your sequence “{text}” (set in Explore mode): {parsed.ok ? '' : parsed.error}</p>;
  return (
    <dl className="r2-kv">
      <dt>sequence</dt>
      <dd>
        <Tex tex={`a_0, \\ldots, a_{${enc.n}} = ${enc.seq.join(', ')}`} />
      </dd>
      <dt>
        <Tex tex="j,\ d_1" />
      </dt>
      <dd>
        <Tex tex={`j = ${enc.j},\\ d_1 = \\mathrm{lcm}(1, \\ldots, ${enc.j}) =`} /> <Big v={enc.d1} max={30} />
      </dd>
      <dt>
        <Tex tex="d_0" />
      </dt>
      <dd>
        <Big v={enc.d0} max={30} /> (moduli pairwise relatively prime: <Mark ok={enc.pairwiseCoprime} />)
      </dd>
      <dt>
        <Tex tex="d" />
      </dt>
      <dd>
        <Big v={enc.d} max={30} />
      </dd>
      <dt>
        <Tex tex="\beta(d, i)" />
      </dt>
      <dd>
        {enc.checks.map((c) => c.value.toString()).join(', ')} <Mark ok={enc.ok} />
      </dd>
    </dl>
  );
}
