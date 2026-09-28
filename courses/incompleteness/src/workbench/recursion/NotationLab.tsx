// Notations for primitive recursive functions (section "Primitive Recursion Notations"): the
// book's Comp_{k,n}[F, G_0, …] and Rec_k[F, G], typed or generated from a definition, and the
// numbering #(F) of notations from section "Non-Primitive Recursive Functions".

import { useMemo } from 'react';
import type { RF } from '../../engine/recursive/rf';
import * as Lib from '../../engine/computability/library';
import { bookCode, notation, parseNotation, safeIndex, size, stage, unwrap } from '../../engine/computability/primrec';
import { evaluate as evalNat, formatMagnitude, magnitude, type Nat } from '../../engine/numbers/nat';
import { arity } from '../../engine/recursive/rf';
import { Panel } from '../coding';
import { Tex } from '../../ui/Tex';
import { Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { DefTree, fmtBig, useRemembered } from './common';

const CHOICES: { id: string; label: string; build: () => RF }[] = [
  { id: 'add', label: 'add', build: Lib.add },
  { id: 'pred', label: 'pred', build: Lib.pred },
  { id: 'exp', label: 'exp', build: Lib.exp },
  { id: 'tsub', label: 'x ∸ y', build: Lib.tsub },
  { id: 'IsZero', label: 'χ_IsZero', build: Lib.isZero },
  { id: 'const_3', label: 'const₃', build: () => Lib.constN(3) },
];

function arityText(f: RF): string {
  const a = arity(f);
  return a.ok ? String(a.arity) : '?';
}

function sizeText(n: Nat): string {
  const v = evalNat(n, 1200);
  if (v !== null) return fmtBig(v, 60);
  return `a number with ${formatMagnitude(magnitude(n))}`;
}

export function NotationLab() {
  const [text, setText] = useRemembered<string>('notation', 'Rec_1[P^1_0, Comp_{1,3}[succ, P^3_2]]');
  const parsed = useMemo(() => parseNotation(text), [text]);
  const rf = parsed.ok ? parsed.rf : null;
  return (
    <div className="workbench">
      <Panel n={1} title="A notation" prov={parsed.ok ? <Prov kind="computed">well formed</Prov> : <Prov kind="failed">not a notation</Prov>}>
        <p className="wb-note">
          Type a notation, or generate one from a function of <Ref k="cmp:rec:exa:sec" />. Subscripts may be left out; if you give them, they are checked. You may write{' '}
          <code>add</code> or <code>mult</code> as abbreviations.
        </p>
        <div className="rc-presets" role="group" aria-label="Generate from a definition">
          <span className="fi-label">Generate</span>
          {CHOICES.map((c) => (
            <button key={c.id} className="chip-btn" onClick={() => setText(notation(c.build()))}>
              {c.label}
            </button>
          ))}
        </div>
        <label className="fi-label" htmlFor="nl-in">
          Notation
        </label>
        <textarea id="nl-in" className="fi-field mono" rows={3} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-invalid={!parsed.ok} />
        {!parsed.ok && (
          <p className="rc-err" role="alert">
            {parsed.error} (at character {parsed.at + 1}).
          </p>
        )}
        {rf && (
          <div className="rc-math">
            <Tex tex={notation(rf, { keepNames: true, tex: true })} />
          </div>
        )}
      </Panel>
      {rf && <Reading rf={rf} abbreviations={parsed.ok ? parsed.abbreviations : []} />}
    </div>
  );
}

function Reading({ rf, abbreviations }: { rf: RF; abbreviations: string[] }) {
  const top = unwrap(rf);
  const code = useMemo(() => bookCode(rf), [rf]);
  const idx = useMemo(() => safeIndex(rf), [rf]);
  const s = stage(rf);
  const parts: { label: string; f: RF }[] =
    top.k === 'comp' ? [{ label: 'H (outer)', f: top.f }, ...top.gs.map((g, i) => ({ label: `G${'₀₁₂₃₄₅₆₇₈₉'[i] ?? i}`, f: g }))] : top.k === 'rec' ? [{ label: 'G (base)', f: top.f }, { label: 'H (step)', f: top.g }] : [];
  return (
    <>
      <Panel n={2} title="What it denotes" prov={<Prov kind="computed" />}>
        <p className="wb-note">
          Every notation is built by the clauses of the definition of the primitive recursive functions, so it names one. {abbreviations.length > 0 && <>(add and mult were expanded into the book’s definitions.)</>}{' '}
          It has {size(rf)} symbols’ worth of structure{s !== null ? <> and appears at stage {s}</> : null}.
        </p>
        <DefTree f={rf} />
        {abbreviations.length > 0 && (
          <p className="small sans muted">
            Complete notation: <span className="rc-mono">{notation(rf).length > 600 ? `${notation(rf).slice(0, 600)}…` : notation(rf)}</span>
          </p>
        )}
      </Panel>
      <Panel n={3} title={<>Its number <Tex tex="\#(F)" /></>} prov={<Prov kind="computed" />}>
        <p className="wb-note">
          <Ref k="cmp:rec:npr:sec" /> numbers notations with sequence codes: <Tex tex="\#(\mathrm{zero}) = \langle 0\rangle" />, <Tex tex="\#(\mathrm{succ}) = \langle 1\rangle" />,{' '}
          <Tex tex="\#(P^n_i) = \langle 2, n, i\rangle" />, <Tex tex="\#(\mathrm{Comp}_{k,l}[H, G_0, \ldots]) = \langle 3, k, l, \#(H), \#(G_0), \ldots\rangle" />,{' '}
          <Tex tex="\#(\mathrm{Rec}_l[G, H]) = \langle 4, l, \#(G), \#(H)\rangle" />.
        </p>
        {code ? (
          <>
            <div className="rc-scroll">
              <table className="rc-table">
                <tbody>
                  {top.k === 'comp' || top.k === 'rec' ? (
                    <tr>
                      <th scope="row">shape</th>
                      <td className="wrap">
                        <Tex
                          tex={
                            top.k === 'rec'
                              ? `\\langle 4, ${arityText(top.f)}, \\#(G), \\#(H) \\rangle`
                              : `\\langle 3, ${top.gs.length}, ${arityText(top.gs[0])}, \\#(H), ${top.gs.map((_, i) => `\\#(G_{${i}})`).join(', ')} \\rangle`
                          }
                        />
                      </td>
                    </tr>
                  ) : null}
                  {parts.map((p) => {
                    const c = bookCode(p.f);
                    return (
                      <tr key={p.label}>
                        <th scope="row">{p.label}</th>
                        <td className="wrap">
                          <span className="rc-mono">{notation(p.f).length > 80 ? `${notation(p.f).slice(0, 80)}…` : notation(p.f)}</span>
                          <br />
                          <span className="small muted sans">#: {c ? sizeText(c) : '—'}</span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <th scope="row">#(F)</th>
                    <td className="wrap">
                      <b>{sizeText(code)}</b>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="wb-note">
              The numbers explode: each level puts the codes of the parts into exponents. That does not matter for the theory — all that is needed is that notations can be
              coded and decoded mechanically. (This edition’s tables use a different, bijective numbering of definitions, so that small numbers are all used; there this
              definition has index {idx.ok ? <span className="rc-mono">{fmtBig(idx.e, 30)}</span> : <>with about {Math.round(idx.log10) + 1} digits</>}.)
            </p>
          </>
        ) : (
          <p className="wb-note">This definition has no number in the book’s numbering of notations.</p>
        )}
      </Panel>
    </>
  );
}
