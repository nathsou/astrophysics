// Section "Computably Enumerable Sets not Closed under Complement": if A = W_d and its complement
// is W_e, run both computations side by side until one halts — that decides A. For K there is
// no e to race against.

import { useMemo, useState } from 'react';
import { Panel } from '../coding';
import { NotAProof, Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { raceSides, type RaceResult, type Side } from '../../engine/computability/ce';
import { UNARY_EXAMPLES } from '../../engine/computability/examples';
import { Big, exampleIndex, parseNat } from './shared';

const byId = (id: string) => exampleIndex(UNARY_EXAMPLES.find((u) => u.id === id)!);

function Verdict({ r, aName }: { r: RaceResult; aName: string }) {
  if (r.verdict === 'inA') return <span className="ct-verdict yes">x ∈ {aName}</span>;
  if (r.verdict === 'inComplement') return <span className="ct-verdict no">x ∉ {aName}</span>;
  if (r.verdict === 'both')
    return (
      <span className="ct-verdict no" title="both computations halted: the two sets overlap, so they are not complements">
        both halted!
      </span>
    );
  return <span className="ct-verdict maybe">no answer yet</span>;
}

export function RaceLab() {
  const [left, setLeft] = useState<'evens' | 'K'>('evens');
  const [rightText, setRight] = useState(() => byId('odds').toString());
  const [fuel, setFuel] = useState(3000);
  const d: Side = left === 'K' ? { kind: 'K' } : { kind: 'index', e: byId('evens') };
  const e = parseNat(rightText);
  const rows = useMemo(() => (e === null ? [] : Array.from({ length: 16 }, (_, x) => raceSides(d, { kind: 'index', e }, BigInt(x), fuel))), [left, e, fuel]);
  const aName = left === 'K' ? 'K' : 'A';
  const counts = rows.reduce((c, r) => ({ ...c, [r.verdict]: (c[r.verdict] ?? 0) + 1 }), {} as Record<string, number>);
  return (
    <div className="workbench">
      <Panel n={1} title="Deciding A by racing two semi-decision procedures" prov={<Prov kind="computed" />}>
        <p className="wb-note">
          Given <Tex tex="A = W_d" /> and <Tex tex="\overline{A} = W_e" />, run <Tex tex="\varphi_d(x)" /> and <Tex tex="\varphi_e(x)" /> side by side with the same growing
          budget. Exactly one of them halts, so the procedure always answers. (The book searches for the least s with <Tex tex="T(d, x, s) \lor T(e, x, s)" />; racing the two
          step counts is the same idea.)
        </p>
        <div className="ct-two">
          <div className="ct-box">
            <h4>A semi-decider for {aName}</h4>
            <div className="seg" role="radiogroup" aria-label="first set">
              <button role="radio" aria-checked={left === 'evens'} className={`chip-btn ${left === 'evens' ? 'current try' : ''}`} onClick={() => { setLeft('evens'); setRight(byId('odds').toString()); }}>
                A = the even numbers
              </button>
              <button role="radio" aria-checked={left === 'K'} className={`chip-btn ${left === 'K' ? 'current try' : ''}`} onClick={() => setLeft('K')}>
                K
              </button>
            </div>
            <p className="wb-note">
              {left === 'K' ? (
                <>
                  x ∈ K is semi-decided by running <Tex tex="\varphi_x(x)" />.
                </>
              ) : (
                <>
                  <Tex tex="d" /> = <Big n={byId('evens')} max={20} />: <Tex tex="\mu z\,\mathrm{par}(x)" />, which halts exactly on even x.
                </>
              )}
            </p>
          </div>
          <div className="ct-box">
            <h4>A candidate e for the complement</h4>
            <label className="fi-label" htmlFor="ct-race-e">
              index e
            </label>
            <input id="ct-race-e" className={`fi-field mono ct-index-field ${e === null ? 'invalid' : ''}`} value={rightText} onChange={(ev) => setRight(ev.target.value)} inputMode="numeric" />
            <div className="seg" style={{ marginTop: 6 }}>
              <button className="chip-btn" onClick={() => setRight(byId('odds').toString())}>
                μz IsZero(par(x)) (odd x)
              </button>
              <button className="chip-btn" onClick={() => setRight(byId('min45').toString())}>
                μz P²₁(z, x) (only x = 0)
              </button>
              <button className="chip-btn" onClick={() => setRight(byId('nowhere').toString())}>
                nowhere defined
              </button>
            </div>
          </div>
        </div>
        <div className="ct-controls">
          <label>
            budget{' '}
            <select className="fi-examples" value={fuel} onChange={(ev) => setFuel(Number(ev.target.value))} aria-label="budget">
              {[100, 1000, 3000, 10_000].map((f) => (
                <option key={f} value={f}>
                  {f.toLocaleString('en-US')} calls
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ct-table-wrap">
          <table className="ct-table" aria-live="polite">
            <thead>
              <tr>
                <th scope="col">x</th>
                <th scope="col">{left === 'K' ? <Tex tex="\varphi_x(x)" /> : <Tex tex="\varphi_d(x)" />}</th>
                <th scope="col">
                  <Tex tex="\varphi_e(x)" />
                </th>
                <th scope="col">answer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.x.toString()}>
                  <td>{r.x.toString()}</td>
                  <td>{r.d !== null ? <span className="ct-o value">halts after {r.d}</span> : <span className="ct-o fuel">…</span>}</td>
                  <td>{r.e !== null ? <span className="ct-o value">halts after {r.e}</span> : <span className="ct-o fuel">…</span>}</td>
                  <td>
                    <Verdict r={r} aName={aName} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="wb-note">
          {left === 'evens' && counts.inA && counts.inComplement && !counts.both && !counts.unknown
            ? 'Every x got an answer, and each answer is right: the evens are decidable, as they must be.'
            : left === 'K'
              ? `For K, pick any candidate e. Wherever both halt, W_e is not the complement of K; wherever neither halts within the budget, the race has not answered. The corollary says every e fails in one of these ways (on some x, possibly far out): the complement of K is not c.e.`
              : 'Where both halt the two sets overlap; where neither halts the procedure has not answered. Only a true pair of complements makes the race a decision procedure.'}
        </p>
        <NotAProof>
          {left === 'K'
            ? 'A finite table cannot show that a candidate fails; the corollary does, for all of them at once.'
            : 'The table checks sixteen inputs. That the race decides A for every x is the theorem.'}
        </NotAProof>
      </Panel>
    </div>
  );
}
