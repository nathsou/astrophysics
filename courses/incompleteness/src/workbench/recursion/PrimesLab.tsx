// Primes (section "Primes"): how generous the bound x! + 1 of nextPrime is, and the recursion
// p(0) = 2, p(x + 1) = nextPrime(p(x)). Computed directly (by trial division); the official
// definitions are evaluated in the library explorer below it for small arguments.

import { useMemo } from 'react';
import { factorial } from '../../engine/computability/beta';
import { Panel } from '../coding';
import { Tex } from '../../ui/Tex';
import { NotAProof, Prov } from '../../ui/Prov';
import { fmtBig } from './common';
import { nextPrime } from './entries';

export function PrimesLab() {
  const rows = useMemo(
    () =>
      Array.from({ length: 13 }, (_, i) => {
        const x = BigInt(i);
        const bound = factorial(x) + 1n;
        const n = nextPrime(x);
        return { x, bound, n };
      }),
    [],
  );
  const ps = useMemo(() => {
    const out: bigint[] = [2n];
    for (let i = 0; i < 11; i++) out.push(nextPrime(out[out.length - 1]));
    return out;
  }, []);
  return (
    <div className="workbench">
      <Panel n={1} title={<>The bound in <Tex tex="\mathrm{nextPrime}(x) = (\min y \le x!+1)\,(y > x \land \mathrm{Prime}(y))" /></>} prov={<Prov kind="computed" />}>
        <p className="wb-note">
          Euclid’s argument shows that there is always a prime above <Tex tex="x" /> and at most <Tex tex="x! + 1" />, so bounded minimization with that bound finds it. The bound
          is very generous: the next prime comes long before it.
        </p>
        <div className="rc-scroll">
          <table className="rc-table">
            <thead>
              <tr>
                <th scope="col" className="num">
                  x
                </th>
                <th scope="col" className="num">
                  bound <Tex tex="x! + 1" />
                </th>
                <th scope="col" className="num">
                  <Tex tex="\mathrm{nextPrime}(x)" />
                </th>
                <th scope="col" className="num">
                  tries from <Tex tex="x+1" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.x)}>
                  <td className="num">{r.x.toString()}</td>
                  <td className="num">{fmtBig(r.bound, 14)}</td>
                  <td className="num">{r.n.toString()}</td>
                  <td className="num">{(r.n - r.x).toString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="wb-note">
          The official definition by bounded minimization runs its primitive recursion through every <Tex tex="y" /> up to the bound, testing <Tex tex="\mathrm{Prime}(y)" /> each
          time — primitive recursion cannot stop early. That is why the library below evaluates it only for <Tex tex="x \le 3" />. Being primitive recursive is about the{' '}
          <em>form</em> of the definition, not about computing efficiently.
        </p>
        <NotAProof>
          Twelve rows in which the next prime is below the bound. That it always is, for every <Tex tex="x" />, is Euclid’s theorem, proved at the end of the section.
        </NotAProof>
      </Panel>
      <Panel n={2} title={<>The primes by primitive recursion: <Tex tex="p(0) = 2,\ p(x+1) = \mathrm{nextPrime}(p(x))" /></>} prov={<Prov kind="computed" />}>
        <div className="rc-scroll">
          <table className="rc-table">
            <tbody>
              <tr>
                <th scope="row">x</th>
                {ps.map((_, i) => (
                  <td key={i} className="num">
                    {i}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">
                  <Tex tex="p_x" />
                </th>
                {ps.map((p, i) => (
                  <td key={i} className="num">
                    {p.toString()}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="wb-note">
          These are the primes <Tex tex="p_0 = 2, p_1 = 3, \ldots" /> used in the sequence codes of <Tex tex="\langle a_0, \ldots, a_n\rangle = p_0^{a_0 + 1} \cdots p_n^{a_n + 1}" /> in the next section.
        </p>
      </Panel>
    </div>
  );
}
