import { useMemo } from 'react';
import { PLANS } from '../content/course';
import { sourceIndex } from '../content/source';
import { ProvLegend } from '../ui/Prov';
import { parseFormula } from '../engine/syntax/parse';
import { godel } from '../engine/coding/godel';
import { FormulaView } from '../ui/FormulaView';
import { NatView } from '../ui/NatView';
import { Attribution } from './Attribution';
import { symTex } from '../engine/syntax/language';
import { Tex } from '../ui/Tex';

export function Home() {
  document.title = 'Incompleteness and Computability — an executable edition';
  const demo = useMemo(() => {
    const f = parseFormula('x = 0');
    return { f, g: godel(f) };
  }, []);
  const titles = new Map(sourceIndex.chapters.flatMap((c) => c.sections.map((s) => [s.id, { ...s, chapter: c }] as const)));
  return (
    <div className="page no-inspector home-page">
      <div className="column home">
        <header className="home-hero">
          <p className="kicker">An executable edition of Richard Zach’s textbook</p>
          <h1 className="home-title">
            Incompleteness
            <br />
            and Computability
          </h1>
          <p className="home-formula" aria-label="G if and only if not Prov of the code of G">
            G ↔ ¬Prov(<span className="corner">⌜</span>G<span className="corner">⌝</span>)
          </p>
          <p className="lede">
            Gödel’s theorems rest on a few precise constructions: codes for symbols, numbers for formulas, formulas that represent computations, and a sentence that
            talks about its own number. Here you build those objects, watch them behave, and follow each one into the proof where it is used.
          </p>
          <hr className="rule-short" />
        </header>
        <nav aria-label="Chapters">
          <ol className="home-chapters">
            {sourceIndex.chapters.map((c) => (
              <li key={c.id}>
                <a href={`#/s/${c.sections[0].id}`}>
                  <span className="num">{c.number}</span>
                  <span>{c.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <hr className="rule-short rule-long" />
        <figure className="home-demo" aria-label="A formula, its symbols, and its Gödel number">
          <div className="demo-row">
            <span className="demo-tag formula">formula</span>
            <FormulaView node={demo.f} />
          </div>
          <div className="demo-row">
            <span className="demo-tag">symbols</span>
            <Tex tex={demo.g.items.map((i) => (i.k === 'sym' ? symTex(i.sym) : '?')).join(String.raw`\;\;`)} />
          </div>
          <div className="demo-row">
            <span className="demo-tag number">Gödel number</span>
            <NatView n={demo.g.number} style="powers" maxItems={6} expandable={false} />
          </div>
          <figcaption className="muted">The book’s example: the formula v₀ = 0, officially the six symbols =(v₀,c₀). Computed live.</figcaption>
        </figure>

        <h2>Three ways into every section</h2>
        <div className="mode-cards">
          <div>
            <h3>Intuition</h3>
            <p>Why the construction is needed and what it does, with small examples that use the object you are working on.</p>
          </div>
          <div>
            <h3>Explore</h3>
            <p>A workbench. Edit the formula, function or sentence; step through encoding, substitution, evaluation or derivation; hover anything to see what it is.</p>
          </div>
          <div>
            <h3>Formal</h3>
            <p>The book’s definitions, theorems and proofs, converted from its LaTeX source, with your object worked through where the text uses it.</p>
          </div>
        </div>
        <p>The object you build stays the same when you switch modes, so you can construct it, test it, and then find it inside the proof.</p>

        <h2>What everything is</h2>
        <p>Every piece of content says where it comes from and what kind of claim it makes:</p>
        <ProvLegend />
        <p className="muted small sans">
          A computed example or a checked derivation is about <em>one</em> case. The general theorems are proved in the text; nothing here replaces those proofs.
        </p>

        <h2>Contents of this edition</h2>
        <p>
          The whole book — nine chapters and four appendices — is converted from its LaTeX source and can be read in Formal mode. Sections with Intuition and Explore modes are
          listed below; the others are marked as text-only in the table of contents. To find a definition or theorem, use search (<kbd>/</kbd>) or the <a href="#/index">index of defined terms</a>.
        </p>
        {sourceIndex.chapters.map((c) => {
          const plans = PLANS.filter((p) => c.sections.some((s) => s.id === p.id));
          if (plans.length === 0) return null;
          return (
            <section key={c.id} className="home-chapter">
              <h3>
                {c.number && <span className="num">{/^[A-Z]$/.test(c.number) ? `Appendix ${c.number}` : `Chapter ${c.number}`}</span>} {c.title}
              </h3>
              <ol className="home-toc">
                {plans.map((p) => {
                  const s = titles.get(p.id)!;
                  return (
                    <li key={p.id}>
                      <a href={`#/s/${p.id}`}>
                        <span className="num">{s.number}</span> {s.title}
                      </a>
                      <span className="muted"> — {p.blurb}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
        <p>
          <a className="chip-btn primary" href="#/s/inc.int.bgr">
            Start at the beginning →
          </a>
        </p>
        <Attribution />
      </div>
    </div>
  );
}
