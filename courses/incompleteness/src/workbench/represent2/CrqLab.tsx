// Computable functions are representable in Q (section 4.8): the structure of the proof, and
// primitive recursion eliminated from a definition, equation by equation.

import { useMemo, useState } from 'react';
import * as Lib from '../../engine/computability/library';
import { eliminateRecursion } from '../../engine/represent/elimrec';
import { Tex } from '../../ui/Tex';
import { Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { Panel } from '../coding';
import './represent2.css';

const DEFS = [
  { id: 'add', label: 'add', build: Lib.add },
  { id: 'mult', label: 'mult', build: Lib.mult },
  { id: 'exp', label: 'exp', build: Lib.exp },
  { id: 'fac', label: 'fac', build: Lib.fac },
  { id: 'tsub', label: 'x ∸ y', build: Lib.tsub },
];

export function CrqProofMap() {
  return (
    <div className="r2-flow" aria-label="Structure of the proof">
      <div className="r2-flow-box">
        <h4>A computable function</h4>
        By the Church–Turing thesis, general recursive: defined from <Tex tex="\mathrm{zero}, \mathrm{succ}, P^n_i" /> by composition, primitive recursion and regular minimization.
      </div>
      <div className="r2-flow-arrow">
        eliminate primitive recursion with β: <Ref k="inc:req:bet:lem:beta" />, <Ref k="inc:req:pri:lem:prim-rec" />
      </div>
      <div className="r2-flow-box accent">
        <h4>A definition without primitive recursion</h4>
        From <Tex tex="\mathrm{zero}, \mathrm{succ}, P^n_i, +, \times, \chi_=" /> by composition and regular minimization only.
      </div>
      <div className="r2-flow-arrow">induction on this definition</div>
      <div className="r2-flow-box checked">
        <h4>A representing formula</h4>
        The basic functions are representable (<Ref k="inc:req:bre:sec" />); representable functions are closed under composition (<Ref k="inc:req:cmp:prop:rep-composition" />) and regular minimization (<Ref k="inc:req:min:prop:rep-minimization" />).
      </div>
    </div>
  );
}

export function CrqLab() {
  const [id, setId] = useState('mult');
  const entry = DEFS.find((d) => d.id === id)!;
  const eqs = useMemo(() => eliminateRecursion(entry.build()), [entry]);
  return (
    <div className="workbench">
      <Panel n={1} title="The structure of the proof" prov={<Prov kind="added" />}>
        <CrqProofMap />
      </Panel>
      <Panel n={2} title="Primitive recursion eliminated, definition by definition" prov={<Prov kind="computed" />}>
        <p className="wb-note">
          Pick a function defined in <Ref k="cmp:rec::chap" />. Every definition by primitive recursion in it is replaced by a search for the β-code of its history, as in <Ref k="inc:req:pri:lem:prim-rec" />; everything else stays.
        </p>
        <div className="seg" role="radiogroup" aria-label="Function">
          {DEFS.map((d) => (
            <button key={d.id} className="chip-btn" role="radio" aria-checked={d.id === id} aria-pressed={d.id === id} onClick={() => setId(d.id)}>
              {d.label}
            </button>
          ))}
        </div>
        <div className="r2-table-wrap">
          <table className="r2-table">
            <caption className="sr-only">Definitions, original and without primitive recursion</caption>
            <thead>
              <tr>
                <th scope="col">definition</th>
                <th scope="col">without primitive recursion</th>
              </tr>
            </thead>
            <tbody>
              {eqs.map((e) => (
                <tr key={e.name}>
                  <td>
                    <Tex tex={`${e.lhs.replace(/\(.*$/, '')} = ${e.original}`} />
                  </td>
                  <td>
                    {e.viaBeta ? <Tex tex={`${e.lhs} = ${e.rewritten}`} /> : <span className="r2-muted r2-small">unchanged (no primitive recursion)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="wb-note">
          The rewritten definitions use β, which is defined from <Tex tex="+" />, <Tex tex="\times" /> and <Tex tex="\chi_=" /> by composition and regular minimization (via <Tex tex="J" />, <Tex tex="K" />, <Tex tex="L" /> and <Tex tex="\mathrm{rem}" />), and the bounded quantifier <Tex tex="\forall i < y" />, which <Ref k="inc:req:bet:sec" /> shows can be expressed the same way. Each rewritten line has a representing formula by the constructions of <Ref k="inc:req:bre:sec" />–<Ref k="inc:req:min:sec" /> — far too long to display, but built the same way as in the Representability workbench.
        </p>
      </Panel>
    </div>
  );
}
