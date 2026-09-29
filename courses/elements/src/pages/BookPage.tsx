import { Suspense, useEffect, useState } from 'react';
import { byId, citeLabel, hrefOf, loadBook, ROMAN } from '../text';
import type { Book } from '../text/types';
import { loadModern, modernTitle, splitFrontMatter } from '../content/modern';
import { hasFigure } from '../content/figures';
import { renderInlines } from '../ui/HeathText';
import { Markdown } from '../ui/Markdown';
import { usesParallelPostulate } from '../graph/deps';
import { readStore } from '../ui/progress';
import { useStore } from '../ui/store';
import { BOOKS } from '../content/books';

export function BookPage({ n }: { n: number }) {
  const [book, setBook] = useState<Book | null>(null);
  const [intro, setIntro] = useState<string | null>(null);
  const read = useStore(readStore);
  useEffect(() => {
    setBook(null);
    setIntro(null);
    void loadBook(n).then(setBook);
    void loadModern(`${n}.intro`).then((m) => setIntro(m ? splitFrontMatter(m).body : null));
    window.scrollTo(0, 0);
  }, [n]);
  const info = BOOKS[n - 1];
  return (
    <div className="page book-page">
      <header className="book-head">
        <span className={`book-shape ${info.theme}`} style={info.theme === 'plane' ? { ['--c' as string]: ['var(--red)', 'var(--yellow)', 'var(--blue)'][(n - 1) % 3] } : undefined} aria-hidden="true" />
        <p className="kicker">Book {ROMAN[n]}</p>
        <h1>{info.title}</h1>
        <p className="lede">{info.blurb}</p>
      </header>
      {intro && (
        <Suspense fallback={null}>
          <Markdown src={intro} className="book-intro" />
        </Suspense>
      )}
      {!book && <p className="muted">Loading…</p>}
      {book?.sections.map((s) => (
        <section key={s.title} className={`book-section sec-${s.kind}`}>
          <h2>{s.title}</h2>
          <ol className={`item-list ${s.kind}`}>
            {s.items.map((it) => {
              const first = it.paras.find((p) => p.role === 'enunciation') ?? it.paras[0];
              const title = modernTitle(it.id);
              const e = byId.get(it.id)!;
              return (
                <li key={it.id} className={read[it.id] ? 'read' : ''}>
                  <a href={hrefOf(it.id)} className="item-link">
                    <span className="n">{s.kind === 'prop' ? citeLabel(it.id) : it.n}</span>
                    <span className="body">
                      {title && <span className="t">{title}</span>}
                      <span className="enun">{first ? renderInlines(first.c, { next: () => null, noLinks: true }) : null}</span>
                    </span>
                    <span className="marks">
                      {s.kind === 'prop' && <span className={`sh diamond ${e.problem ? 'blue' : 'red'}`} title={e.problem ? 'Construction' : 'Theorem'} />}
                      {s.kind === 'prop' && n <= 6 && usesParallelPostulate(it.id) && <span className="sh tri" style={{ ['--c' as string]: 'var(--amber)' }} title="Uses the parallel postulate" />}
                      {hasFigure(it.id) && <span className="sh dot yellow" title="Interactive figure" />}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <nav className="pager">
        {n > 1 ? <a href={`#/book/${n - 1}`}>← Book {ROMAN[n - 1]}</a> : <span />}
        {n < 13 ? <a href={`#/book/${n + 1}`}>Book {ROMAN[n + 1]} →</a> : <span />}
      </nav>
    </div>
  );
}
