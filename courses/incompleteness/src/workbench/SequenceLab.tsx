// Sequence codes (section Sequences): len, (s)_i, append and concatenation, computed.

import { useMemo, useState } from 'react';
import { decodeSeq, encodeSeq } from '../engine/numbers/nat';
import { nthPrime } from '../engine/numbers/primes';
import { sequenceStore } from '../content/objects';
import { useStore } from '../ui/store';
import { Tex } from '../ui/Tex';
import { Prov } from '../ui/Prov';
import { Panel } from './coding';

function parseList(s: string): bigint[] | null {
  const t = s.trim();
  if (!t) return [];
  const parts = t.split(/[\s,]+/).filter(Boolean);
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  const xs = parts.map(BigInt);
  if (xs.length > 12 || xs.some((x) => x > 400n)) return null;
  return xs;
}

export function SequenceLab() {
  const text = useStore(sequenceStore);
  const xs = useMemo(() => parseList(text), [text]);
  const [extra, setExtra] = useState('5');
  const code = xs ? encodeSeq(xs) : null;
  const a = /^\d+$/.test(extra) && BigInt(extra) < 100n ? BigInt(extra) : null;
  return (
    <div className="workbench">
      <Panel n={1} title="A sequence and its code" prov={<Prov kind="computed" />}>
        <label className="fi-label" htmlFor="seq-in">
          The sequence (up to 12 numbers, each at most 400)
        </label>
        <input id="seq-in" className="fi-field mono" value={text} onChange={(e) => sequenceStore.set(e.target.value)} />
        {!xs ? (
          <p className="fi-error">Write numbers separated by commas.</p>
        ) : (
          <>
            <p>
              <Tex
                tex={`\\langle ${xs.join(', ') || ''} \\rangle = ${xs.length ? xs.map((x, i) => `${nthPrime(i)}^{${x} + 1}`).join(' \\cdot ') : '\\Lambda = 0'}`}
              />
            </p>
            <p className="mono small seq-code">{code!.toString().length > 400 ? `${code!.toString().slice(0, 400)}… (${code!.toString().length} digits)` : code!.toString()}</p>
            <table className="code-table">
              <tbody>
                <tr>
                  <th scope="row">
                    <Tex tex="\mathrm{len}(s)" />
                  </th>
                  <td>{xs.length}</td>
                  <td className="muted small">the number of primes dividing s (Proposition: len is primitive recursive)</td>
                </tr>
                {xs.map((x, i) => (
                  <tr key={i}>
                    <th scope="row">
                      <Tex tex={`(s)_{${i}}`} />
                    </th>
                    <td>{x.toString()}</td>
                    <td className="muted small">
                      <Tex tex={`p_{${i}}^{${x + 2n}} \\nmid s`} />, but <Tex tex={`p_{${i}}^{${x + 1n}} \\mid s`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Panel>
      {xs && (
        <Panel n={2} title="append and concat" prov={<Prov kind="computed" />}>
          <label className="args-input sans">
            append a ={' '}
            <input value={extra} onChange={(e) => setExtra(e.target.value)} aria-label="element to append" />
          </label>
          {a !== null && (
            <p>
              <Tex tex={`\\mathrm{append}(s, ${a}) = s \\cdot p_{\\mathrm{len}(s)}^{${a}+1} = s \\cdot ${nthPrime(xs.length)}^{${a + 1n}} = \\langle ${[...xs, a].join(', ')} \\rangle`} />
            </p>
          )}
          <p>
            <Tex tex={`s \\frown s = \\langle ${[...xs, ...xs].join(', ')} \\rangle`} />{' '}
            <span className="muted sans small">({decodeSeq(encodeSeq([...xs, ...xs])).ok ? 'decodes back correctly' : '?'})</span>
          </p>
          <p className="muted sans small">
            Why the +1 in the exponents? Without it, ⟨2, 7, 3⟩ and ⟨2, 7, 3, 0, 0⟩ would have the same code:{' '}
            <Tex tex={`2^2 3^7 5^3 = 2^2 3^7 5^3 7^0 11^0`} />.
          </p>
        </Panel>
      )}
    </div>
  );
}
