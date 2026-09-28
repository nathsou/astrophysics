import { sourceIndex, upstreamInfo } from '../content/source';
import report from '../content/source/report.json';
import { OVERRIDES } from '../formal/overrides';
import { ProvLegend } from '../ui/Prov';
import { Attribution } from './Attribution';
import type { Diagnostic } from '../content/schema';

export function About() {
  document.title = 'About this edition · Incompleteness and Computability';
  const diags = (report as { diagnostics: Diagnostic[] }).diagnostics;
  const w = upstreamInfo.work;
  return (
    <div className="page no-inspector">
      <div className="column about">
        <p className="kicker">About this edition</p>
        <h1>Sources, licence and changes</h1>

        <h2>The original work</h2>
        <p>
          <a href={w.url}>
            <em>{w.title}</em>
          </a>{' '}
          by <a href={w.authorUrl}>{w.author}</a>, {w.edition}, is part of <a href={w.projectUrl}>{w.project}</a>. It is licensed under the{' '}
          <a href={upstreamInfo.license.url}>{upstreamInfo.license.name}</a> licence. The text in Formal mode is converted from its LaTeX source; the sources used are:
        </p>
        <table className="about-table sans">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Pinned commit</th>
              <th>Files used</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(upstreamInfo.repositories).map(([name, r]) => (
              <tr key={name}>
                <td>
                  <a href={r.url}>{name}</a>
                </td>
                <td>
                  <a href={`${r.url}/tree/${r.commit}`}>
                    <code>{r.commit.slice(0, 10)}</code>
                  </a>
                </td>
                <td>
                  {r.paths.map((p) => (
                    <code key={p} className="path">
                      {p}
                    </code>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          No figures, photographs or other assets from the original are reused. The book’s cover and the portraits in its biographies chapter come from other sources and are
          not included.
        </p>

        <h2>What is changed</h2>
        <ul>
          <li>The LaTeX is converted to structured content by a converter written for this edition (see “Conversion” below). The wording of the converted text is not edited.</li>
          <li>Each section is presented in three modes. Intuition and Explore modes, the workbenches, exercises and all panels marked “Added”, “Computed” or “Checked” are new.</li>
          <li>
            Formal mode keeps the book’s numbering: chapters 1–9 and appendices A–D, as in the book. References to parts of the Open Logic Project outside this book are shown
            as such.
          </li>
          <li>
            Where the book leaves a convention open, this edition fixes one and says so. In particular the official symbols of the language of arithmetic are taken to be 0 = c₀,
            ′ = f¹₀, + = f²₀, × = f²₁ and &lt; = P²₀; variables v₀, v₁, … are displayed x, y, z, u, w, x₀, y₀, …
          </li>
          <li>End-of-chapter problems are shown where they occur in the source rather than collected at the end of the chapter.</li>
        </ul>

        <h2>Where this edition departs from the printed text</h2>
        <p>
          The converted text is never edited. Where a checker, an evaluator or a close reading found a slip, the page concerned shows the book’s version next to a corrected one and says
          which is which. So far:
        </p>
        <ul className="corrections">
          <li>
            <a href="#/s/inc.req.pri?mode=explore">4.4</a>: the text introduces “the function h(x, z⃗)” but its equations and proof use h(x⃗, y).
          </li>
          <li>
            <a href="#/s/inc.req.bre?mode=intuition">4.5</a>: the introduction writes the representing formulas as x₀′ = y and (x₀ + x₁) = y, and the proof for addition argues from (n̄ + m̄) = y, while the propositions state y = x₀′ and y = (x₀ + x₁).
          </li>
          <li>
            <a href="#/s/inc.req.cmp?mode=intuition">4.6</a>: the problem cites the proof of the same proposition twice; the first reference should be to the one-variable case.
          </li>
          <li>
            <a href="#/s/inc.inp.s1c?mode=intuition">4.11</a>: in the proof of the lemma on atomic sentences, m is fixed as the value of t₂ but Q ⊢ t₂ = n̄ is written; the step “by transitivity” to k̄′ + t₁ = t₂ needs k̄′ + n̄ = m̄ (Q cannot commute); the false-&lt; case also needs Q1 and Q4 and contradicts Q2, not Q3; and in the next lemma the case k = 0 of the bounded universal quantifier is an empty conjunction, not an empty disjunction.
          </li>
          <li>
            <a href="#/s/inc.inp.prc?mode=intuition">5.6</a>: Prov(y) is defined with the relation Prf rather than the formula representing it.
          </li>
          <li>
            <a href="#/s/inc.inp.lob?mode=explore">5.8</a>: the theorem refers to the conditions P1–P3 “from” 5.7, where they are stated in 5.6; and the last line of the proof cites (5.21) and (5.25), where propositional logic needs (5.22) and (5.25).
          </li>
          <li>
            <a href="#/s/cmp.thy.cmp?mode=formal">6.12</a>: in the proof, T(e, x, h(x)) should be T(d, x, h(x)) (A is the domain of φ<sub>d</sub>). The chapter also notes a numeral n̄ written for ē, and an off-by-one in the count of conjuncts in Craig’s trick.
          </li>
          <li>
            <a href="#/s/mod.mar.stm?mode=intuition">7.5</a>: “not in the domain of s” should be “not in the range of s”.
          </li>
          <li>
            <a href="#/s/mod.mar.mpa?mode=intuition">7.8</a>: the proposition that every x has a unique predecessor fails for x = 0; it needs x ≠ 0.
          </li>
          <li>
            <a href="#/s/mod.mar.cmp?mode=intuition">7.9</a>: the bijection g with g(n) = n + 1 for n &gt; 0 should have g(n) = n − 1. Smaller misprints are noted in 7.1 and 7.7.
          </li>
          <li>
            <a href="#/s/sol.met.spa?mode=intuition">8.7</a>: the formula A₊ quantifies ∀w but constrains u only at x; the recursion clause should be ∀w u(w′) = u(w)′.
          </li>
          <li>
            <a href="#/s/sol.set.crd?mode=explore">8.12</a>: Inf(X) as printed does not require u to map X into X, so finite sets satisfy it; Count(X) ends with X = Y where X ⊆ Y is needed; and Aleph₁(X) as printed holds exactly for finite X (X is one of its own subsets), so the continuum hypothesis as written in 8.13 is false in every structure. All are refuted on small domains by the evaluator, and repaired versions are given.
          </li>
          <li>
            <a href="#/s/lam.rep.cur?mode=intuition">9.5</a>: the last line of the general computation substitutes into P, which is never defined; N is meant.
          </li>
          <li>
            <a href="#/s/lam.rep.arf?mode=intuition">9.7</a>: Mult′ as printed computes a·a; and Exp b̄ 0̄ reduces to λx.x, which is only η-equivalent to 1̄, so Exp λ-defines exponentiation only for exponents ≥ 1 (Exp′ has no exception).
          </li>
          <li>
            <a href="#/s/lam.ldf.prf?mode=formal">9.10</a>: the recursion equation in the proof of the primitive-recursion lemma has h where g is meant; the composition lemma writes G₀, …, G<sub>k</sub> for G<sub>k−1</sub>.
          </li>
          <li>
            <a href="#/s/lam.ldf.min?mode=intuition">9.12</a>: the recursive call in Search drops f, and the proof λ-defines “h” where the lemma calls the function g.
          </li>
          <li>
            <a href="#/s/ic.deriv.text?mode=explore">Appendix A</a>: the derivation of ∀x ¬x &lt; 0 cites Q5 and Q6 where it uses Q4 and Q5, and λ₃ lists the cases of trichotomy in a different order from the lemma it cites.
          </li>
          <li>
            <a href="#/s/fol.ntd.pro?mode=explore">C.6</a>: one intermediate tree names ¬Elim “⊥Intro”. (Its finished tree has an →Intro without a label; the book’s rules allow that, since it discharges nothing, and the checker accepts it.)
          </li>
        </ul>

        <h2>What everything is</h2>
        <ProvLegend />

        <h2>Conversion</h2>
        <p>
          The converter walks the book’s driver file <code>ic.tex</code> exactly as LaTeX would: it follows the chapter and section imports, selects material by the book’s tags,
          qualifies labels as the Open Logic referencing package does, and numbers environments per chapter. Macros are read from the upstream configuration files{' '}
          <code>open-logic-config.sty</code> and <code>ic-config.sty</code> by a small interpreter of LaTeX’s <code>xparse</code> declarations, so notation changes upstream
          flow through. A few macros are defined upstream with TeX primitives that the web renderer (KaTeX) cannot run; those are replaced explicitly:
        </p>
        <table className="about-table sans">
          <tbody>
            {Object.entries(OVERRIDES).map(([name, o]) => (
              <tr key={name}>
                <td>
                  <code>\{name}</code>
                </td>
                <td>{o.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Anything the converter does not understand is reported and displayed as written, never silently dropped. The current report:</p>
        <ul className="diag-list sans">
          {diags.length === 0 && <li>No diagnostics.</li>}
          {diags.map((d, i) => (
            <li key={i} className={`diag ${d.level}`}>
              <span className="diag-level">{d.level}</span> <code>{d.code}</code> {d.message}
              {d.loc && (
                <span className="muted">
                  {' '}
                  — {d.loc.file}:{d.loc.line}
                </span>
              )}
            </li>
          ))}
        </ul>
        <details>
          <summary className="sans">Macros used in the converted text ({sourceIndex.macros.length})</summary>
          <div className="macro-cloud">
            {sourceIndex.macros.map((m) => (
              <span key={m.name} className={`macro ${m.origin}`} title={`${m.origin}, used ${m.count}×`}>
                \{m.name} <span className="muted">{m.count}</span>
              </span>
            ))}
          </div>
        </details>

        <h2>Updating from upstream</h2>
        <p>
          The upstream files are vendored in <code>courses/incompleteness/upstream/</code> at the commits above. <code>npm run upstream:sync</code> copies newer versions from
          local checkouts, <code>npm run convert</code> regenerates the structured text, and the diff of <code>src/content/source/</code> shows exactly what changed. The build
          fails if the committed conversion is stale or has errors.
        </p>
        <Attribution />
      </div>
    </div>
  );
}
