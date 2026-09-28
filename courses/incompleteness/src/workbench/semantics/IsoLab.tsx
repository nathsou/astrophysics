// Isomorphism of small finite structures: search for an isomorphism, check a map against the five
// conditions of the definition, count automorphisms, and compare the structures on sentences.

import { useMemo, useState } from 'react';
import { tryParseFormula } from '../../engine/syntax/parse';
import { automorphisms, checkIsomorphism, findIsomorphism, relabel } from '../../engine/semantics/iso';
import { trueIn } from '../../engine/semantics/satisfaction';
import { showElem, type Elem, type Structure } from '../../engine/semantics/structure';
import { NotAProof, Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { useStore } from '../../ui/store';
import { Panel } from '../coding';
import { FiniteTables, StructurePicker } from './StructurePicker';
import { Sup, TruthBadge } from './TraceTree';
import { labStore, resolve, type StructureChoice } from './model';
import './sem.css';

const LETTERS = ['p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'k', 'm', 'n', 'o'];

const DEFAULT_SENTENCES = [
  '∀x ∀y (x′ = y′ → x = y)',
  '∀x ¬0 = x′',
  '∃x x′ = x',
  '∀x ∀y (x + y) = (y + x)',
  '∃x ∃y (¬x = 0 ∧ ¬y = 0 ∧ (x × y) = 0)',
  '∀x ∃y (x × y) = 1',
  '∀x ¬x < x',
].join('\n');

export function IsoLab({ id = 'iso', left = { kind: 'mod', n: 4, mode: 'wrap' } as StructureChoice, right = 'copy' }: { id?: string; left?: StructureChoice; right?: 'copy' | 'other' }) {
  const store = labStore(`${id}.iso`, { structure: left, formula: DEFAULT_SENTENCES, assign: {} });
  const st = useStore(store);
  const [rightKind, setRightKind] = useState<'copy' | 'other'>(right);
  const [rightChoice, setRightChoice] = useState<StructureChoice>({ kind: 'mod', n: 5, mode: 'saturate' });
  const rl = useMemo(() => resolve(st.structure), [st.structure]);
  // Shown and reported as M, whatever the chosen structure is called elsewhere.
  const M = useMemo(() => (rl.kind === 'finite' ? { ...rl.M, name: 'M' } : null), [rl]);
  const N: Structure | null = useMemo(() => {
    if (!M) return null;
    if (rightKind === 'copy') {
      const perm = shuffle(M.domain.length);
      return relabel(M, (e) => LETTERS[perm[M.domain.indexOf(e)] % LETTERS.length] + (M.domain.length > LETTERS.length ? String(M.domain.indexOf(e)) : ''), 'N');
    }
    const r = resolve(rightChoice);
    return r.kind === 'finite' ? { ...r.M, name: 'N' } : null;
  }, [M, rightKind, rightChoice]);
  const iso = useMemo(() => (M && N ? findIsomorphism(M, N) : null), [M, N]);
  const autos = useMemo(() => (M && M.domain.length <= 7 ? automorphisms(M).length : null), [M]);
  return (
    <div className="workbench sem-lab">
      <Panel n={1} title="Two structures for the same language" prov={<Prov kind="computed" />}>
        <div className="sem-two">
          <div>
            <StructurePicker value={st.structure} onChange={(s) => store.set({ ...st, structure: s })} scope="finite" label="M" />
            {M && <FiniteTables M={M} compact />}
          </div>
          <div>
            <div className="seg" role="group" aria-label="The second structure">
              <button className="chip-btn" aria-pressed={rightKind === 'copy'} onClick={() => setRightKind('copy')}>
                N = M with its elements renamed
              </button>
              <button className="chip-btn" aria-pressed={rightKind === 'other'} onClick={() => setRightKind('other')}>
                N = another structure
              </button>
            </div>
            {rightKind === 'other' && <StructurePicker value={rightChoice} onChange={setRightChoice} scope="finite" label="N" />}
            {N && <FiniteTables M={N} compact />}
          </div>
        </div>
      </Panel>
      {M && N && iso && (
        <Panel n={2} title="Is M ≃ N?" prov={<Prov kind="computed" />}>
          <div className="sem-result" aria-live="polite">
            <TruthBadge t={iso.ok} />
            <span>
              {iso.ok ? (
                <>
                  <b>Isomorphic.</b> An isomorphism h, found after trying {iso.tried} partial assignments:
                </>
              ) : (
                <>
                  <b>Not isomorphic:</b> {iso.reason}
                  {iso.tried > 0 ? ` (${iso.tried} partial maps tried).` : '.'}
                </>
              )}
            </span>
          </div>
          {iso.ok && (
            <p className="sem-map">
              {[...iso.h].map(([a, b], i) => (
                <span key={i}>
                  h({showElem(a)}) = {showElem(b)}
                </span>
              ))}
            </p>
          )}
          {autos !== null && (
            <p className="wb-note">
              M has {autos} automorphism{autos === 1 ? '' : 's'} (isomorphisms onto itself){autos === 1 ? ': only the identity — every element is pinned down by the structure.' : '.'}
            </p>
          )}
          <MapChecker M={M} N={N} />
        </Panel>
      )}
      {M && N && <Sentences M={M} N={N} iso={!!iso?.ok} text={st.formula} setText={(formula) => store.set({ ...st, formula })} />}
    </div>
  );
}

/** A fixed, deterministic "shuffle" so that the renamed copy is not in the same order. */
function shuffle(n: number): number[] {
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = (i * 7 + 3) % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

function MapChecker({ M, N }: { M: Structure; N: Structure }) {
  const [map, setMap] = useState<Record<string, string>>({});
  const h = new Map<Elem, Elem>(M.domain.map((a, i) => [a, N.domain.find((b) => showElem(b) === map[showElem(a)]) ?? N.domain[(i + 1) % N.domain.length]]));
  const viol = checkIsomorphism(M, N, h);
  return (
    <fieldset className="sem-editor">
      <legend className="sans small">Check a map h of your own against the definition</legend>
      <div className="sem-assign-row">
        {M.domain.map((a) => (
          <label key={showElem(a)} className="sem-inline">
            h({showElem(a)}) =
            <select value={showElem(h.get(a)!)} onChange={(e) => setMap({ ...map, [showElem(a)]: e.target.value })}>
              {N.domain.map((b) => (
                <option key={showElem(b)} value={showElem(b)}>
                  {showElem(b)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div aria-live="polite">
        {viol.length === 0 ? (
          <p className="sem-ok">All five conditions hold: this h is an isomorphism.</p>
        ) : (
          <ul className="sem-viol">
            {viol.map((v, i) => (
              <li key={i}>
                condition ({v.clause}) — {['', 'injective', 'surjective', 'constants', 'predicates', 'functions'][v.clause]}: <Sup text={v.detail} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </fieldset>
  );
}

function Sentences({ M, N, iso, text, setText }: { M: Structure; N: Structure; iso: boolean; text: string; setText: (s: string) => void }) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20);
  const rows = lines.map((l) => {
    const p = tryParseFormula(l);
    if (!p.ok) return { l, error: p.error };
    return { l, m: trueIn(M, p.value, { trace: false }).truth, n: trueIn(N, p.value, { trace: false }).truth };
  });
  const differ = rows.filter((r) => 'm' in r && r.m !== r.n && r.m !== 'unknown' && r.n !== 'unknown');
  return (
    <Panel n={3} title="Sentences true in M and in N" prov={<Prov kind="computed" />}>
      <label className="fi-label" htmlFor="iso-sentences">
        One sentence per line
      </label>
      <textarea id="iso-sentences" className="sem-sentences" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <div className="sem-scroll">
        <table className="sem-compare">
          <thead>
            <tr>
              <th scope="col">sentence</th>
              <th scope="col">M</th>
              <th scope="col">N</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={'m' in r && r.m !== r.n ? 'differs' : ''}>
                <td className="sem-ftext">{r.l}</td>
                {'error' in r ? (
                  <td colSpan={2} className="sem-viol">
                    {r.error}
                  </td>
                ) : (
                  <>
                    <td className="c">
                      <TruthBadge t={r.m!} />
                    </td>
                    <td className="c">
                      <TruthBadge t={r.n!} />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="wb-note" aria-live="polite">
        {differ.length > 0 ? (
          <>
            {differ.length} sentence{differ.length === 1 ? '' : 's'} tell{differ.length === 1 ? 's' : ''} M and N apart, so M ≢ N — and so they cannot be isomorphic (<Ref k="mod:bas:iso:thm:isom" />: isomorphic structures are elementarily equivalent).
          </>
        ) : iso ? (
          <>
            The structures are isomorphic, so no sentence can tell them apart (<Ref k="mod:bas:iso:thm:isom" />).
          </>
        ) : (
          'None of these sentences tells M and N apart. That does not make them elementarily equivalent: that is a claim about every sentence.'
        )}
      </p>
      {iso && <NotAProof>The table checks the sentences listed; the theorem covers all sentences, by induction on formulas.</NotAProof>}
    </Panel>
  );
}
