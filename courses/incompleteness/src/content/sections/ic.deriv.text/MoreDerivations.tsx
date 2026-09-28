// Appendix A, continued: the second half of Rosser's proof, the first half with Lemma
// less-nsucc derived, and derivations in PA with induction axioms. Engine: proof/rosser.ts,
// proof/pa.ts; every derivation is verified by the natural deduction checker.

import { useMemo, useState } from "react";
import { check } from "../../../engine/proof/nd";
import { qUnfolded, ROSSER_MAX, rprovR } from "../../../engine/proof/arith";
import {
  deriveRosserFirstHalfDerived,
  deriveRosserSecondHalf,
} from "../../../engine/proof/rosser";
import { checkPA, PA_THEOREMS } from "../../../engine/proof/pa";
import * as Ast from "../../../engine/syntax/ast";
import { formulaEq } from "../../../engine/syntax/ops";
import { formulaTex } from "../../../engine/syntax/print";
import { ProofDebugger } from "../../../ui/ProofDebugger";
import { NotAProof, Prov } from "../../../ui/Prov";
import { Tex } from "../../../ui/Tex";
import { Ref } from "../../../formal/FormalText";
import { Panel } from "../../../workbench/coding";
import "../../../workbench/nd/nd.css";
import "./more.css";

type Which = "rosser2" | "rosser1" | "pa";

export function MoreDerivations({
  initial = "rosser2",
  only,
}: {
  initial?: Which;
  only?: Which;
}) {
  const [which, setWhich] = useState<Which>(only ?? initial);
  return (
    <div className="workbench ndb mdv">
      {!only && (
        <div className="seg" role="radiogroup" aria-label="Derivation">
          {(
            [
              ["rosser2", "Rosser: ¬RProv(⌜R⌝)"],
              ["rosser1", "Rosser: RProv(⌜R⌝), with ∀x (x < n̄′ → …) derived"],
              ["pa", "PA, with induction"],
            ] as [Which, string][]
          ).map(([w, l]) => (
            <button
              key={w}
              type="button"
              className="chip-btn"
              role="radio"
              aria-checked={which === w}
              aria-pressed={which === w}
              onClick={() => setWhich(w)}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      {which === "rosser2" ? (
        <Rosser2Panel />
      ) : which === "rosser1" ? (
        <Rosser1Panel />
      ) : (
        <PAPanel />
      )}
    </div>
  );
}

function NField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="mdv-field">
      {label}{" "}
      <input
        className="ndb-input small"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) =>
          onChange(
            Math.max(
              min,
              Math.min(max, Math.floor(Number(e.target.value)) || min),
            ),
          )
        }
      />
    </label>
  );
}

function Rosser2Panel() {
  const [m, setM] = useState(2);
  const [lemmas, setLemmas] = useState<"derived" | "hypotheses">("hypotheses");
  const d = useMemo(() => deriveRosserSecondHalf(m, { lemmas }), [m, lemmas]);
  const c = useMemo(() => check(d, { axioms: qUnfolded() }), [d]);
  const ok = c.valid && formulaEq(d.concl, Ast.not(rprovR()));
  return (
    <Panel
      n={1}
      title={<>Rosser’s theorem: if T ⊢ ¬R then T ⊢ ¬RProv(⌜R⌝)</>}
      prov={ok ? <Prov kind="checked" /> : <Prov kind="failed" />}
    >
      <p className="wb-note">
        The second half of the proof of <Ref k="inc:inp:ros:thm:rosser" /> in
        the appendix. If m is the Gödel number of a refutation of R (ρ₁: Q ⊢
        Refut(m̄, ⌜R⌝)) and, T being consistent, no k is the Gödel number of a
        derivation of R (π<sub>k</sub>: Q ⊢ ¬Prf(k̄, ⌜R⌝)), then from Prf(a, ⌜R⌝)
        the book derives m̄ &lt; a: λ₂ gives a = 0 ∨ … ∨ a = m̄ ∨ m̄ &lt; a, and
        each case a = k̄ contradicts π<sub>k</sub> (π′<sub>k</sub>). So ∀x
        (Prf(x, ⌜R⌝) → ∃z (z &lt; x ∧ Refut(z, ⌜R⌝))), from which the book
        passes to ¬RProv(⌜R⌝) without detail; here that step is written out (two
        ∃Elims and ¬Intro).
      </p>
      <div className="ndb-note">
        For m = 0 there is no λ₁ (nothing is below 0): the case a &lt; 0 is
        refuted by <Ref k="inc:req:min:lem:less-zero" />.
      </div>
      <div className="ndb-row">
        <NField label="m" value={m} min={0} max={ROSSER_MAX} onChange={setM} />
        <div className="seg" role="radiogroup" aria-label="The lemmas">
          <button
            type="button"
            className="chip-btn"
            role="radio"
            aria-checked={lemmas === "hypotheses"}
            aria-pressed={lemmas === "hypotheses"}
            onClick={() => setLemmas("hypotheses")}
          >
            lemmas as hypotheses (as the book)
          </button>
          <button
            type="button"
            className="chip-btn"
            role="radio"
            aria-checked={lemmas === "derived"}
            aria-pressed={lemmas === "derived"}
            onClick={() => setLemmas("derived")}
          >
            lemmas derived in Q
          </button>
        </div>
        <span className="mdv-size">{c.size} steps</span>
      </div>
      <ProofDebugger
        deriv={d}
        check={c}
        title={<Tex tex={`\\mathbf{T} \\vdash ${formulaTex(d.concl)}`} />}
        hypotheses={{
          ρ1: (
            <>
              ρ₁: Refut represents the refutation relation, and m is the Gödel
              number of a refutation of R.
            </>
          ),
          trichotomy: (
            <>
              <Ref k="inc:req:min:lem:trichotomy" /> for m (the book’s λ₃).
              Switch to “lemmas derived in Q” to replace it by its derivation.
            </>
          ),
          "less-nsucc": (
            <>
              <Ref k="inc:req:min:lem:less-nsucc" /> for m − 1 (the book’s λ₁).
            </>
          ),
          ...Object.fromEntries(
            Array.from({ length: m + 1 }, (_, k) => [
              `π${k}`,
              <>
                π{k}: Prf represents the proof relation, and {k} is not the
                Gödel number of a derivation of R.
              </>,
            ]),
          ),
        }}
      />
      <NotAProof>
        The hypotheses are what the proof takes from elsewhere: Prf and Refut
        are not spelled out, and ⌜R⌝ is symbolic. The checker verifies that
        ¬RProv(⌜R⌝) follows from them by the rules, for m = {m}. With T ⊢ R ↔
        ¬RProv(⌜R⌝), this gives T ⊢ R, and T would be inconsistent — that last
        step is the text’s.
      </NotAProof>
    </Panel>
  );
}

function Rosser1Panel() {
  const [n, setN] = useState(3);
  const d = useMemo(() => deriveRosserFirstHalfDerived(n), [n]);
  const c = useMemo(() => check(d, { axioms: qUnfolded() }), [d]);
  const ok = c.valid && formulaEq(d.concl, rprovR());
  return (
    <Panel
      n={1}
      title={<>Rosser’s first half, with the lemma about <Tex tex="<" /> derived in Q</>}
      prov={ok ? <Prov kind="checked" /> : <Prov kind="failed" />}
    >
      <p className="wb-note">
        The first half of the proof (shown above with <Ref k="inc:req:min:lem:less-nsucc" /> as a
        hypothesis), with that hypothesis replaced by the lemma’s derivation for
        n − 1 = {n - 1}. What remains assumed is only what concerns Prf and
        Refut: δ₁ and the ρ<sub>k</sub>.
      </p>
      <div className="ndb-row">
        <NField label="n" value={n} min={1} max={ROSSER_MAX} onChange={setN} />
        <span className="mdv-size">{c.size} steps</span>
      </div>
      <ProofDebugger
        deriv={d}
        check={c}
        title={
          <Tex tex="\mathbf{T} \vdash \mathrm{RProv}(\ulcorner R \urcorner)" />
        }
        hypotheses={{
          δ1: (
            <>
              δ₁: Prf represents the proof relation of T in Q, and n is the
              Gödel number of a derivation of R.
            </>
          ),
          ...Object.fromEntries(
            Array.from({ length: n }, (_, k) => [
              `ρ${k}`,
              <>
                ρ{k}: Refut represents the refutation relation, and {k} is not
                the Gödel number of a refutation of R.
              </>,
            ]),
          ),
        }}
      />
    </Panel>
  );
}

function PAPanel() {
  const [id, setId] = useState(PA_THEOREMS[0].id);
  const t = PA_THEOREMS.find((x) => x.id === id)!;
  const d = useMemo(() => t.derive(), [t]);
  const c = useMemo(() => checkPA(d), [d]);
  const ok = c.valid && formulaEq(d.concl, t.statement());
  return (
    <Panel
      n={1}
      title={<>Derivations in PA</>}
      prov={ok ? <Prov kind="checked" /> : <Prov kind="failed" />}
    >
      <p className="wb-note">
        <Ref k="inc:int:def:sec" /> defines <b>PA</b> as the axioms of Q
        together with every instance of the induction schema. The checker is
        given PA the way its axiomatization works: an axiom of the derivation is
        accepted if it is one of Q1–Q8 (Q8 written out), or if the book’s test
        for induction instances (
        <a href="#/s/inc.int.def?mode=explore">section 1.2, Explore</a>)
        recognises it. Each of these is a single derivation of a universal
        sentence — not a family of derivations for numerals, as in Q.
      </p>
      <div className="seg" role="radiogroup" aria-label="Theorem">
        {PA_THEOREMS.map((x) => (
          <button
            key={x.id}
            type="button"
            className="chip-btn"
            role="radio"
            aria-checked={id === x.id}
            aria-pressed={id === x.id}
            onClick={() => setId(x.id)}
          >
            {x.text}
          </button>
        ))}
      </div>
      <p className="wb-note">
        {t.summary} <span className="mdv-size">{c.size} steps</span>
      </p>
      <div className="mdv-ind">
        <div className="mdv-ind-title">
          Induction axioms used, and the book’s test
        </div>
        <ul>
          {c.induction.map((i) => (
            <li key={i.name}>
              <div className="mdv-ind-f">
                <Tex tex={formulaTex(i.formula)} />
              </div>
              <div className={i.recognized ? "mdv-ind-ok" : "mdv-ind-bad"}>
                {i.recognized
                  ? "✓ an instance of the induction schema"
                  : "✗ not an instance"}
              </div>
              <ol className="mdv-ind-steps">
                {i.steps.map((s, k) => (
                  <li key={k} className={s.ok ? "" : "bad"}>
                    {s.text}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      </div>
      <ProofDebugger
        key={id}
        deriv={d}
        check={c}
        theory="PA"
        title={<Tex tex={`\\mathbf{PA} \\vdash ${formulaTex(d.concl)}`} />}
      />
      {id === "succadd" && (
        <p className="wb-note">
          Compare <Ref k="inc:req:min:lem:succ" />: Q proves (a′ + n̄) = (a + n̄)′
          for each numeral n̄, by an induction outside Q, and the text remarks
          that Q does not prove the universal sentence. PA does, with one
          induction axiom.
        </p>
      )}
    </Panel>
  );
}
