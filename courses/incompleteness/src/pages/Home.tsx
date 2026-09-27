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
    <div className="page no-inspector">
      <div className="column home">
        <p className="kicker">An executable edition of the Open Logic text</p>
        <h1 className="home-title">Incompleteness and Computability</h1>
        <p className="lede">
          Gödel’s theorems rest on a few precise constructions: codes for symbols, numbers for formulas, formulas that represent computations, and a sentence that
          talks about its own number. Here you build those objects, watch them behave, and follow each one into the proof where it is used.
        </p>
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
          <figcaption className="muted sans small">The book’s example: the formula v₀ = 0, officially the six symbols =(v₀,c₀). Computed live.</figcaption>
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
          The first sections to receive the full treatment are the arithmetization of syntax, representability in <Tex tex="\mathbf{Q}" />, and the fixed-point lemma. All
          sections of chapters 2–5 can already be read in Formal mode.
        </p>
        <ol className="home-toc">
          {PLANS.map((p) => {
            const s = titles.get(p.id);
            if (!s) return null;
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
        <p>
          <a className="chip-btn primary" href="#/s/inc.art.int">
            Start with the arithmetization of syntax →
          </a>
        </p>
        <Attribution />
      </div>
    </div>
  );
}
