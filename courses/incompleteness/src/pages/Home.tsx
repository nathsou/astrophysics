import { useMemo } from 'react';
import { planOf } from '../content/course';
import { sourceIndex } from '../content/source';
import { ProvLegend } from '../ui/Prov';
import { parseFormula } from '../engine/syntax/parse';
import { godel } from '../engine/coding/godel';
import { FormulaView } from '../ui/FormulaView';
import { NatView } from '../ui/NatView';
import { Attribution } from './Attribution';
import { symTex } from '../engine/syntax/language';
import { Tex } from '../ui/Tex';
import { lastVisited } from '../ui/progress';

const FIRST_SECTION = 'inc.int.bgr';
const chapterLabel = (n: string) => (/^[A-Z]$/.test(n) ? `Appendix ${n}` : `Chapter ${n}`);

export function Home() {
  document.title = 'Incompleteness and Computability — an executable edition';
  const demo = useMemo(() => {
    const f = parseFormula('x = 0');
    return { f, g: godel(f) };
  }, []);
  const titles = new Map(sourceIndex.chapters.flatMap((c) => c.sections.map((s) => [s.id, { ...s, chapter: c }] as const)));
  const last = lastVisited((id) => titles.has(id));
  const resume = last && last !== FIRST_SECTION ? titles.get(last)! : null;
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
          <div className="home-cta">
            <a className="chip-btn primary cta" href={`#/s/${FIRST_SECTION}`}>
              Start reading →
            </a>
            {resume && (
              <a className="chip-btn cta" href={`#/s/${resume.id}`}>
                Continue: {resume.number} {resume.title}
              </a>
            )}
            <a className="chip-btn cta" href="#/s/inc.inp.fix?mode=explore">
              Try the fixed-point lab
            </a>
          </div>
          <p className="home-cta-note">
            Or jump to a chapter in the{' '}
            <a
              href="#/"
              onClick={(e) => {
                e.preventDefault();
                const h = document.getElementById('home-contents');
                h?.scrollIntoView({ block: 'start' });
                h?.focus({ preventScroll: true });
              }}
            >
              contents
            </a>{' '}
            below.
          </p>
        </header>
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

        <nav aria-labelledby="home-contents">
          <h2 id="home-contents" tabIndex={-1}>
            Contents
          </h2>
          <p>
            The whole book — nine chapters and four appendices — is converted from its LaTeX source and can be read in Formal mode. Almost every section also has Intuition and
            Explore modes; the few that show only the book’s text are marked <span aria-hidden="true">¶</span>
            <span className="sr-only">“text only”</span>. To find a definition or theorem, use search (<kbd>/</kbd>) or the <a href="#/index">index of defined terms</a>.
          </p>
          {sourceIndex.chapters.map((c) => (
            <details key={c.id} className="home-chapter">
              <summary id={`ch-${c.id}`} style={{ cursor: 'pointer', padding: '0.8rem 0', fontWeight: 600 }}>
                <span>
                  {c.number && <span className="num">{chapterLabel(c.number)}</span>} {c.title}
                </span>
              </summary>
              <ol className="home-toc">
                {c.sections.map((s) => {
                  const p = planOf(s.id);
                  const interactive = !!(p && (p.intuition || p.explore));
                  return (
                    <li key={s.id} className={interactive ? undefined : 'text-only'}>
                      <a href={`#/s/${s.id}`}>
                        <span className="num">{s.number}</span> {s.title}
                      </a>
                      {interactive ? (
                        <span className="muted"> — {p!.blurb}</span>
                      ) : (
                        <span className="muted">
                          {' '}
                          — <span aria-hidden="true">¶</span> the book’s text only
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </details>
          ))}
        </nav>
        <p className="home-end">
          <a className="chip-btn primary cta" href={`#/s/${FIRST_SECTION}`}>
            Start reading →
          </a>
        </p>
        <Attribution />
      </div>
    </div>
  );
}
