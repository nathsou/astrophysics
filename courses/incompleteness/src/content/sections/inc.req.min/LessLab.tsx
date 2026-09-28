// Section 4.7: the lemmas about < and the minimization case, as derivations generated for chosen
// numbers and verified by the natural deduction checker (engine: proof/less.ts,
// represent/represent.ts).

import { useMemo, useState, type ReactNode } from "react";
import { check, type Deriv } from "../../../engine/proof/nd";
import { num } from "../../../engine/proof/q";
import { qUnfolded } from "../../../engine/proof/arith";
import {
  deriveLessFact,
  deriveLessNSucc,
  deriveTrichotomy,
  lessNSuccStatement,
  trichotomyStatement,
} from "../../../engine/proof/less";
import {
  deriveClauses,
  instance,
  MIN_VALUE_MAX,
  representing,
} from "../../../engine/represent/represent";
import { R, type RF } from "../../../engine/recursive/rf";
import * as Ast from "../../../engine/syntax/ast";
import { formulaEq } from "../../../engine/syntax/ops";
import { formulaTex } from "../../../engine/syntax/print";
import { ProofDebugger } from "../../../ui/ProofDebugger";
import { NotAProof, Prov } from "../../../ui/Prov";
import { Tex } from "../../../ui/Tex";
import { Ref } from "../../../formal/FormalText";
import { Panel } from "../../../workbench/coding";
import "../../../workbench/nd/nd.css";
import "./lesslab.css";

type Tab = "nsucc" | "tri" | "facts" | "min";
const UI_MAX = 8;

export function LessLab({
  initial = "nsucc",
  only,
}: {
  initial?: Tab;
  only?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(only ?? initial);
  return (
    <div className="workbench ndb lsl">
      {!only && (
        <div className="seg" role="radiogroup" aria-label="Derivation">
          {(
            [
              ["nsucc", "less-nsucc"],
              ["tri", "trichotomy"],
              ["facts", "k̄ < n̄ or ¬k̄ < n̄"],
              ["min", "a minimization"],
            ] as [Tab, string][]
          ).map(([t, l]) => (
            <button
              key={t}
              type="button"
              className="chip-btn"
              role="radio"
              aria-checked={tab === t}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      {tab === "nsucc" ? (
        <NSuccPanel />
      ) : tab === "tri" ? (
        <TriPanel />
      ) : tab === "facts" ? (
        <FactsPanel />
      ) : (
        <MinPanel />
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="lsl-field">
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

function useChecked(d: Deriv, statement: Ast.Formula | null) {
  return useMemo(() => {
    const c = check(d, { axioms: qUnfolded() });
    const ok = c.valid && (statement === null || formulaEq(d.concl, statement));
    return { c, ok };
  }, [d, statement]);
}

function Size({ n }: { n: number }) {
  return <span className="lsl-size">{n} steps</span>;
}

function NSuccPanel() {
  const [n, setN] = useState(2);
  const d = useMemo(() => deriveLessNSucc(n), [n]);
  const statement = useMemo(() => lessNSuccStatement(n), [n]);
  const { c, ok } = useChecked(d, statement);
  return (
    <Panel
      n={1}
      title={<>Lemma less-nsucc for n = {n}</>}
      prov={ok ? <Prov kind="checked" /> : <Prov kind="failed" />}
    >
      <p className="wb-note">
        <Ref k="inc:req:min:lem:less-nsucc" /> is proved by induction on n.
        Unwound for a particular n, the induction is a recipe: the derivation
        for n contains the one for n − 1 (the inductive hypothesis, used for b),
        and adds the book’s steps — Q3 splits a into 0 or b′; from b′ &lt; n̄+1,
        Q8, Q5 and Q1 give b &lt; n̄; the hypothesis gives b = 0 ∨ … ∨ b = n−1,
        and a = b′ turns each disjunct into one for a. The base case (n = 0)
        uses <Ref k="inc:req:min:lem:less-zero" />, whose derivation from
        appendix A is included.
      </p>
      <div className="ndb-row">
        <NumberField label="n" value={n} min={0} max={UI_MAX} onChange={setN} />
        <Size n={c.size} />
      </div>
      <ProofDebugger
        deriv={d}
        check={c}
        title={<Tex tex={`\\mathbf{Q} \\vdash ${formulaTex(d.concl)}`} />}
      />
      <NotAProof>
        This is the derivation for n = {n}. The lemma for every n is the
        induction in the text, which says how to build each of these
        derivations.
      </NotAProof>
    </Panel>
  );
}

function TriPanel() {
  const [m, setM] = useState(2);
  const d = useMemo(() => deriveTrichotomy(m), [m]);
  const statement = useMemo(() => trichotomyStatement(m), [m]);
  const { c, ok } = useChecked(d, statement);
  return (
    <Panel
      n={1}
      title={<>Lemma trichotomy for m = {m}</>}
      prov={ok ? <Prov kind="checked" /> : <Prov kind="failed" />}
    >
      <p className="wb-note">
        <Ref k="inc:req:min:lem:trichotomy" />, again by induction on m. For an
        arbitrary a, Q3 gives a = 0 (then a &lt; m̄ by Q4 and Q8, or a = 0 itself
        when m = 0) or a = b′; in the second case the derivation for m − 1,
        applied to b, gives three cases, and each is turned into the
        corresponding disjunct for a, exactly as in the text.
      </p>
      <div className="ndb-row">
        <NumberField label="m" value={m} min={0} max={UI_MAX} onChange={setM} />
        <Size n={c.size} />
      </div>
      <ProofDebugger
        deriv={d}
        check={c}
        title={<Tex tex={`\\mathbf{Q} \\vdash ${formulaTex(d.concl)}`} />}
      />
      <NotAProof>
        This is the derivation for m = {m}; the lemma for every m is the
        induction in the text.
      </NotAProof>
    </Panel>
  );
}

function FactsPanel() {
  const [k, setK] = useState(4);
  const [n, setN] = useState(2);
  const d = useMemo(() => deriveLessFact(k, n), [k, n]);
  const statement = useMemo(
    () =>
      k < n ? Ast.less(num(k), num(n)) : Ast.not(Ast.less(num(k), num(n))),
    [k, n],
  );
  const { c, ok } = useChecked(d, statement);
  return (
    <Panel
      n={1}
      title={<>Q decides k̄ &lt; n̄</>}
      prov={ok ? <Prov kind="checked" /> : <Prov kind="failed" />}
    >
      <p className="wb-note">
        If k &lt; n, Q8 with the witness n − k − 1 and{" "}
        <Ref k="inc:req:bre:lem:q-proves-add" /> give k̄ &lt; n̄. If k ≥ n, the
        lemmas do the work: <Ref k="inc:req:min:lem:less-zero" /> when n = 0,
        and otherwise <Ref k="inc:req:min:lem:less-nsucc" /> turns k̄ &lt; n̄ into
        k̄ = 0 ∨ … ∨ k̄ = n−1, each refuted by{" "}
        <Ref k="inc:req:bre:lem:q-proves-neq" />. (The book does not state this
        fact separately; it is what the lemmas give for numerals.)
      </p>
      <div className="ndb-row">
        <NumberField label="k" value={k} min={0} max={UI_MAX} onChange={setK} />
        <NumberField label="n" value={n} min={0} max={UI_MAX} onChange={setN} />
        <Size n={c.size} />
      </div>
      <ProofDebugger
        deriv={d}
        check={c}
        title={<Tex tex={`\\mathbf{Q} \\vdash ${formulaTex(d.concl)}`} />}
      />
    </Panel>
  );
}

const MIN_EXAMPLES: {
  id: string;
  label: string;
  tex: string;
  build: () => RF;
  about: string;
}[] = [
  {
    id: "search",
    label: "μx [χ=(χ=(x, z), 0) = 0]",
    tex: "f(z) = \\mu x\\,[\\chi_=(\\chi_=(x, z), \\mathrm{zero}(x)) = 0]",
    build: () =>
      R.min(
        R.comp(R.basic("chareq"), [
          R.basic("chareq"),
          R.comp(R.zero(), [R.proj(2, 0)]),
        ]),
      ),
    about:
      "g(x, z) is 0 exactly when x = z, so the search stops at z: every w < z is a candidate that has to be excluded.",
  },
  {
    id: "chareq",
    label: "μx [χ=(x, z) = 0]",
    tex: "f(z) = \\mu x\\,[\\chi_=(x, z) = 0]",
    build: () => R.min(R.basic("chareq")),
    about:
      "g(x, z) is 0 when x ≠ z, so the search stops at 0 — or at 1 when z = 0.",
  },
];

function MinPanel() {
  const [ex, setEx] = useState(MIN_EXAMPLES[0].id);
  const [z, setZ] = useState(3);
  const [which, setWhich] = useState<"a" | "b">("b");
  const e = MIN_EXAMPLES.find((x) => x.id === ex)!;
  const f = useMemo(() => e.build(), [e]);
  const r = useMemo(() => deriveClauses(f, [BigInt(z)]), [f, z]);
  const rep = useMemo(() => representing(f), [f]);
  const checks = useMemo(
    () =>
      "error" in r
        ? null
        : {
            a: check(r.a, { axioms: r.axioms }),
            b: check(r.b, { axioms: r.axioms }),
          },
    [r],
  );
  if ("error" in rep) return null;
  const ok =
    checks &&
    !("error" in r) &&
    checks.a.valid &&
    checks.b.valid &&
    formulaEq(r.a.concl, instance(rep, [BigInt(z)], num(r.value))) &&
    formulaEq(
      r.b.concl,
      Ast.forall(
        Ast.v(rep.output),
        Ast.imp(
          instance(rep, [BigInt(z)], Ast.v(rep.output)),
          Ast.eq(Ast.v(rep.output), num(r.value)),
        ),
      ),
    );
  return (
    <Panel
      n={1}
      title={<>Representing a minimization, for one input</>}
      prov={
        ok ? (
          <Prov kind="checked" />
        ) : "error" in r ? undefined : (
          <Prov kind="failed" />
        )
      }
    >
      <p className="wb-note">
        <Ref k="inc:req:min:prop:rep-minimization" />: if f(n) = m, then (a) Q ⊢
        A<sub>f</sub>(n̄, m̄), from clause (a) for g at (m, n), and equation{" "}
        <Ref k="inc:req:min:rep-less" /> — each k &lt; m is excluded using
        clause (b) for g at (k, n) and less-nsucc; and (b) Q ⊢ ∀y (A<sub>f</sub>
        (n̄, y) → y = m̄): for an arbitrary b with A<sub>f</sub>(n̄, b), trichotomy
        leaves b &lt; m̄ (refuted by (4.6)), m̄ &lt; b (refuted by clause (a) for
        g), or b = m̄.
      </p>
      <div className="seg" role="radiogroup" aria-label="Function">
        {MIN_EXAMPLES.map((x) => (
          <button
            key={x.id}
            type="button"
            className="chip-btn"
            role="radio"
            aria-checked={ex === x.id}
            aria-pressed={ex === x.id}
            onClick={() => setEx(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <p className="wb-note">
        <Tex tex={e.tex} />. {e.about}
      </p>
      <div className="ndb-row">
        <NumberField
          label="z"
          value={z}
          min={0}
          max={MIN_VALUE_MAX}
          onChange={setZ}
        />
        {!("error" in r) && (
          <span className="lsl-size" aria-live="polite">
            f({z}) = {String(r.value)} · clause (a): {checks?.a.size} steps ·
            clause (b): {checks?.b.size} steps
          </span>
        )}
      </div>
      {"error" in r ? (
        <p className="wb-note">Not generated: {r.error}.</p>
      ) : (
        <>
          <div className="seg" role="tablist" aria-label="Clause">
            <button
              className="chip-btn"
              role="tab"
              aria-selected={which === "a"}
              aria-pressed={which === "a"}
              onClick={() => setWhich("a")}
            >
              clause (a)
            </button>
            <button
              className="chip-btn"
              role="tab"
              aria-selected={which === "b"}
              aria-pressed={which === "b"}
              onClick={() => setWhich("b")}
            >
              clause (b)
            </button>
          </div>
          {checks &&
            (which === "a" ? (
              <ProofDebugger
                key={`a${ex}${z}`}
                deriv={r.a}
                check={checks.a}
                title={
                  <Tex
                    tex={`\\mathbf{Q} \\vdash A_f(\\overline{${z}}, \\overline{${r.value}})`}
                  />
                }
              />
            ) : (
              <ProofDebugger
                key={`b${ex}${z}`}
                deriv={r.b}
                check={checks.b}
                title={
                  <Tex
                    tex={`\\mathbf{Q} \\vdash \\forall y\\,(A_f(\\overline{${z}}, y) \\rightarrow y = \\overline{${r.value}})`}
                  />
                }
              />
            ))}
          <p className="wb-note">
            The checker is given Q8 with ↔ written out, as in appendix A. The
            lemma derivations inside (less-zero, less-nsucc, trichotomy) are
            grouped by name; expand a group to see its steps.
          </p>
        </>
      )}
      <NotAProof>
        These derivations are for the input z = {z}. That f is represented — for
        every input — is the proposition, proved in the text from the lemmas,
        which are themselves proved by induction.
      </NotAProof>
    </Panel>
  );
}
