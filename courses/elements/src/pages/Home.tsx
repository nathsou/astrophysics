import { BOOKS } from '../content/books';
import { propositions, ROMAN, index } from '../text';
import { readStore } from '../ui/progress';
import { useStore } from '../ui/store';

export function Home() {
  const read = useStore(readStore);
  return (
    <div className="page home">
      <header className="hero">
        <p className="kicker">Euclid · c. 300 BC</p>
        <h1>The Elements</h1>
        <p className="lede">
          All thirteen books and all {propositions.length} propositions. Each one has Thomas Heath’s 1908 translation word for word, a
          modern version in current notation, and a live figure: drag the given points and the construction and its proof follow. You can
          step through a proof one paragraph at a time, or switch to Oliver Byrne’s 1847 style, where colours and shapes stand in for letters.
        </p>
        <div className="hero-actions">
          <a className="btn primary" href="#/1.1">Start with I.1 →</a>
          <a className="btn" href="#/book/1">Book I: definitions and postulates</a>
          <a className="btn" href="#/workshop">The workshop</a>
        </div>
      </header>

      <section className="books-grid" aria-label="The thirteen books">
        {BOOKS.map((b, i) => {
          const n = i + 1;
          const items = index.filter((e) => e.book === n && e.kind === 'prop');
          const done = items.filter((e) => read[e.id]).length;
          return (
            <a key={n} className={`book-card theme-${b.theme}`} href={`#/book/${n}`}>
              <span className="book-roman">{ROMAN[n]}</span>
              <span className="book-title">{b.title}</span>
              <span className="book-blurb">{b.blurb}</span>
              <span className="book-meta">
                {items.length} propositions
                {done > 0 && <span className="progress"> · {done} visited</span>}
              </span>
            </a>
          );
        })}
      </section>

      <section className="home-tools">
        <a className="tool-card" href="#/workshop">
          <span className="tool-title">The workshop</span>
          <span className="tool-desc">
            Compass-and-straightedge puzzles. You start with Postulates 1–3 only, and every construction you solve becomes a tool for the
            next one. Solutions are checked on random configurations, the way property-based tests are.
          </span>
        </a>
        <a className="tool-card" href="#/graph">
          <span className="tool-title">The dependency graph</span>
          <span className="tool-desc">
            Every citation Heath prints, as a graph of all 465 propositions. Trace I.47 down to the postulates, or see everything that rests on the parallel postulate.
          </span>
        </a>
        <a className="tool-card" href="#/explore">
          <span className="tool-title">Explorations</span>
          <span className="tool-desc">
            Playgrounds that go beyond the proofs: the same construction in hyperbolic and spherical geometry, Eudoxus’ ratios as a picture, the Euclidean algorithm on lengths, and the five regular solids.
          </span>
        </a>
        <a className="tool-card" href="#/glossary">
          <span className="tool-title">Glossary</span>
          <span className="tool-desc">Heath’s vocabulary in modern terms: gnomon, application of areas, duplicate ratio, “measures”, and when “equal” means equal in area.</span>
        </a>
      </section>
    </div>
  );
}
