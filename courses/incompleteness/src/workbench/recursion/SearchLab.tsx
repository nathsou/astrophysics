// Unbounded search (sections "Partial Recursive Functions" and "General Recursive Functions"):
// μx f(x, z⃗) computed as the book describes — f(0, z⃗), f(1, z⃗), … until a 0 — with a budget.
// Out of budget is reported as "no answer within N steps", never as "undefined"; where a
// search really is undefined, the reason is an argument, given separately and marked as such.

import { useMemo, useState, type ReactNode } from 'react';
import { R, type RF } from '../../engine/recursive/rf';
import { arity } from '../../engine/recursive/rf';
import * as Lib from '../../engine/computability/library';
import { unboundedSearch, type SearchResult } from '../../engine/computability/search';
import { Ref } from '../../formal/FormalText';
import type { RFSpec } from '../../content/objects';
import { buildWithPaths, FunctionBuilder } from '../FunctionBuilder';
import { Panel } from '../coding';
import { Tex } from '../../ui/Tex';
import { Added, NotAProof, Prov } from '../../ui/Prov';
import { FuelControl, NumField, parseNats, useRemembered } from './common';

const P = R.proj;

interface Preset {
  id: string;
  label: string;
  tex: string;
  build: () => RF;
  regular: boolean;
  why: ReactNode;
  z: string;
}

const PRESETS: Preset[] = [
  {
    id: 'sqrt',
    label: 'μx (z ≤ x·x)',
    tex: '\\mu x\\,(z \\le x \\cdot x) = \\mu x\\,\\bigl(1 \\dot- \\chi_{\\le}(z, x \\cdot x)\\bigr)',
    build: () => Lib.charNot(R.comp(Lib.chiLeq(), [P(2, 1), R.comp(Lib.mult(), [P(2, 0), P(2, 0)])])),
    regular: true,
    why: <>Regular: for every <Tex tex="z" />, <Tex tex="x = z" /> satisfies <Tex tex="z \le x \cdot x" />, so the search always stops, at <Tex tex="\lceil \sqrt z\,\rceil" />.</>,
    z: '10',
  },
  {
    id: 'half',
    label: 'μx (x + x = z)',
    tex: '\\mu x\\,(x + x = z) = \\mu x\\,\\bigl(1 \\dot- \\chi_{=}(x + x, z)\\bigr)',
    build: () => Lib.charNot(R.comp(Lib.chiEq(), [R.comp(Lib.add(), [P(2, 0), P(2, 0)]), P(2, 1)])),
    regular: false,
    why: (
      <>
        For odd <Tex tex="z" /> no <Tex tex="x" /> has <Tex tex="x + x = z" />, so <Tex tex="f(x, z) = 1" /> for every <Tex tex="x" /> and the search never ends:{' '}
        <Tex tex="\mu x\,(x + x = z)" /> is undefined. The function is partial — <Tex tex="z/2" /> on even numbers, undefined on odd ones — and <Tex tex="f" /> is not regular.
      </>
    ),
    z: '7',
  },
  {
    id: 'stuck',
    label: 'μx f(x, z), f(0, z) undefined',
    tex: 'f(x, z) = \\mu w\\,(1 \\dot- x = 0): \\quad f(0, z)\\uparrow, \\quad f(x, z) = 0 \\text{ for } x \\ge 1',
    build: () => R.min(R.comp(Lib.tsub(), [Lib.constN(1, 3), P(3, 1)])),
    regular: false,
    why: (
      <>
        <Tex tex="f(0, z)" /> is itself a search for a <Tex tex="w" /> with <Tex tex="1 \dot- 0 = 0" />, which never succeeds, so <Tex tex="f(0, z)" /> is undefined. By the
        book’s definition, <Tex tex="\mu x\, f(x, z)" /> needs <Tex tex="f(0, z), \ldots, f(x, z)" /> all defined — so it is undefined, even though <Tex tex="f(1, z) = 0" />. The
        procedure agrees: it is stuck computing <Tex tex="f(0, z)" /> and never gets to try <Tex tex="x = 1" />.
      </>
    ),
    z: '5',
  },
  {
    id: 'never',
    label: 'μx (x ≠ x)',
    tex: '\\mu x\\,(x \\ne x) = \\mu x\\,\\bigl(1 \\dot- \\chi_{\\ne}(x, x)\\bigr)',
    build: () => Lib.charNot(Lib.charNot(R.comp(Lib.chiEq(), [P(2, 0), P(2, 0)]))),
    regular: false,
    why: <>No number satisfies <Tex tex="x \ne x" />: the search never stops, for any <Tex tex="z" />. The proof of the halting theorem uses exactly this search to make a function undefined on purpose.</>,
    z: '0',
  },
];

interface State {
  preset: string;
  custom: RFSpec;
  z: string;
}

/** Does the builder's spec use add, mult or χ= (basic functions of the representability chapter)? */
function usesBasic(s: RFSpec): boolean {
  switch (s.k) {
    case 'basic':
      return true;
    case 'comp':
      return usesBasic(s.f) || s.gs.some(usesBasic);
    case 'rec':
      return usesBasic(s.f) || usesBasic(s.g);
    case 'min':
      return usesBasic(s.f);
    default:
      return false;
  }
}

function describe(r: SearchResult, fuel: number, zs: bigint[]): ReactNode {
  const at = (x: bigint | string) => `f(${[String(x), ...zs.map(String)].join(', ')})`;
  if (r.kind === 'found') return <>the least zero is at <Tex tex={`x = ${r.value}`} /></>;
  if (r.kind === 'stuck')
    return (
      <>
        no answer within {fuel.toLocaleString('en-US')} steps: the budget ran out while <Tex tex={at(r.at)} /> was being computed
        {r.at > 0n ? (
          <>
            , after <Tex tex={`${at(0n)}, \\ldots, ${at(r.at - 1n)}`} /> were all computed and nonzero
          </>
        ) : null}
      </>
    );
  return (
    <>
      no answer within the budget: <Tex tex={`${at(0n)}, \\ldots, ${at(r.searchedBelow - 1n)}`} /> were all computed and nonzero; the search would go on with{' '}
      <Tex tex={`x = ${r.searchedBelow}`} />
    </>
  );
}

export function SearchLab({ focus = 'par' }: { focus?: 'par' | 'gen' }) {
  const [st, setSt] = useRemembered<State>(`search.${focus}`, { preset: focus === 'gen' ? 'sqrt' : 'half', custom: { k: 'basic', name: 'chareq' }, z: '7' });
  const [fuel, setFuel] = useState(20_000);
  const preset = PRESETS.find((p) => p.id === st.preset);
  const f = useMemo(() => (preset ? preset.build() : buildWithPaths(st.custom)), [preset, st.custom]);
  const ar = arity(f);
  const errors = useMemo(() => new Map(ar.ok ? [] : ar.errors.map((e) => [e.id, e.message] as const)), [ar]);
  const nz = ar.ok ? ar.arity - 1 : null;
  const zs = useMemo(() => (nz === null ? 'fix the definition first' : nz < 0 ? 'f needs at least the argument x' : parseNats(st.z, nz, 40n)), [nz, st.z]);
  const r = useMemo(() => (typeof zs === 'string' ? null : unboundedSearch(f, zs, { fuel, maxTests: 200 })), [f, zs, fuel]);
  const grid = useMemo(() => {
    if (nz !== 1) return null;
    return Array.from({ length: 12 }, (_, z) => unboundedSearch(f, [BigInt(z)], { fuel: Math.min(fuel, 20_000), maxTests: 200 }));
  }, [f, nz, fuel]);
  return (
    <div className="workbench">
      <Panel n={1} title={<>A search <Tex tex="\mu x\, f(x, \vec z)" /></>} prov={ar.ok ? <span className="muted small sans">f is {ar.arity}-place</span> : <Prov kind="failed">ill-formed</Prov>}>
        <div className="rc-presets" role="group" aria-label="Examples">
          {PRESETS.map((p) => (
            <button key={p.id} className="chip-btn" aria-pressed={st.preset === p.id} onClick={() => setSt({ ...st, preset: p.id, z: p.z })}>
              {p.label}
            </button>
          ))}
          <button className="chip-btn" aria-pressed={!preset} onClick={() => setSt({ ...st, preset: 'custom', z: '3' })}>
            build your own f
          </button>
        </div>
        {preset ? (
          <div className="rc-eqs">
            <Tex tex={preset.tex} />
          </div>
        ) : (
          <>
            <p className="wb-note">
              Build <Tex tex="f(x, \vec z)" />: its first argument is the one searched over. (The default, <Tex tex="\chi_=(x, z)" />, is 0 at every <Tex tex="x \ne z" />.)
            </p>
            <div className="rc-builder">
              <FunctionBuilder spec={st.custom} onChange={(custom) => setSt({ ...st, custom })} errors={errors} />
            </div>
            {usesBasic(st.custom) && (
              <p className="wb-note">
                add, mult and <Tex tex="\chi_=" /> are offered by the builder as basic functions (they are basic in <Ref k="inc:req::chap" />); here they stand for their
                primitive recursive definitions (<Ref k="cmp:rec:prf:sec" />, <Ref k="cmp:rec:prr:sec" />).
              </p>
            )}
          </>
        )}
        <div className="rc-row">
          <NumField id={`sl-z-${focus}`} label={<>parameters <Tex tex="\vec z" /></>} value={st.z} onChange={(v) => setSt({ ...st, z: v })} width={80} hint="natural numbers up to 40" />
          {typeof zs === 'string' && <span className="rc-err">{zs}</span>}
        </div>
        <FuelControl value={fuel} onChange={setFuel} options={[2_000, 20_000, 200_000]} />
      </Panel>
      {r && r.kind === 'error' && <p className="rc-err">{r.error}</p>}
      {r && r.kind !== 'error' && typeof zs !== 'string' && (
        <Panel n={2} title="The search, test by test" prov={<Prov kind="computed" />}>
          <div className="rc-tests" role="list" aria-label="Tests">
            {r.tests.slice(0, 60).map((t) => (
              <span key={String(t.x)} role="listitem" className={`rc-test ${t.value === 0n ? 'zero' : t.value === undefined ? 'stuck' : ''}`}>
                f({t.x.toString()}{zs.length ? ', ' + zs.join(', ') : ''}) = {t.value === undefined ? '… unfinished' : t.value.toString()}
              </span>
            ))}
            {r.tests.length > 60 && <span className="rc-hint">… {r.tests.length - 60} more tests</span>}
          </div>
          <p className="wb-result" aria-live="polite">
            {r.kind === 'found' ? (
              <Tex tex={`\\mu x\\, f(${['x', ...zs].join(', ')}) = ${r.value}`} />
            ) : (
              <span className="rc-unknown">{describe(r, fuel, zs)}</span>
            )}{' '}
            <span className="rc-hint">({r.calls.toLocaleString('en-US')} steps used)</span>
          </p>
          {r.kind !== 'found' && (
            <p className="wb-note">
              Running out of budget is not evidence that the search is undefined: a larger budget might find a zero. Whether it ever will cannot, in general, be decided by
              running it — that is the halting problem.
            </p>
          )}
          {preset && (
            <Added label="Why — an argument, not a computation">
              <p className="sans small">{preset.why}</p>
            </Added>
          )}
        </Panel>
      )}
      {grid && (
        <Panel n={3} title={<>For <Tex tex="z = 0, 1, \ldots, 11" /></>} prov={<Prov kind="computed" />}>
          <div className="rc-scroll">
            <table className="rc-table rc-grid">
              <tbody>
                <tr>
                  <th scope="row">z</th>
                  {grid.map((_, z) => (
                    <td key={z}>{z}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">
                    <Tex tex="\mu x\, f(x, z)" />
                  </th>
                  {grid.map((g, z) => (
                    <td key={z} className={g.kind === 'found' ? 'one' : ''} title={g.kind === 'found' ? undefined : 'no answer within the budget'}>
                      {g.kind === 'found' ? g.value.toString() : g.kind === 'error' ? '!' : '?'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="small sans muted">? = no answer within the budget.</p>
          <p className="wb-note">
            {focus === 'gen' ? (
              <>
                <Tex tex="f" /> is <em>regular</em> if it is total and for every <Tex tex="z" /> some <Tex tex="x" /> has <Tex tex="f(x, z) = 0" />. General recursive functions
                may only search in regular functions, so every search they perform stops. A row of answers here is consistent with regularity; it cannot establish it — regularity
                is a claim about all <Tex tex="z" />.
              </>
            ) : (
              <>
                A partial recursive function may be undefined for some arguments. Where it is defined, its value is found by finitely many steps; where it is not, no finite
                amount of running shows it.
              </>
            )}
          </p>
          {preset && focus === 'gen' && (
            <p className="small sans">
              {preset.regular ? <span className="rc-ok">This f is regular (by the argument above).</span> : <span className="rc-bad">This f is not regular (by the argument above).</span>}
            </p>
          )}
          <NotAProof>Twelve values of z. Whether f is regular is settled by an argument about every z, not by this table.</NotAProof>
        </Panel>
      )}
    </div>
  );
}
