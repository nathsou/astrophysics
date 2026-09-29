import { useEffect, useState } from 'react';
import { BOOKS } from '../content/books';
import { propositions, ROMAN, index } from '../text';
import { readStore } from '../ui/progress';
import { useStore } from '../ui/store';

// The figure of I.1 on the default configuration (A = (−1, 0), B = (1, 0)) in a 600 × 433.3 view
// box, and the order in which the hero builds it. The steps are paragraph numbers of Heath's I.1.
const A = { x: 216.7, y: 216.7 };
const B = { x: 383.3, y: 216.7 };
const C = { x: 300, y: 72.3 };
const R = 166.7;
const FROM = { AB: 1, k1: 3, k2: 4, C: 5, tri: 11 };
const STEPS = [1, 3, 4, 5, 11, 11, 0];
const NOTES: Record<number, string> = {
  0: 'A finite straight line.',
  1: 'The given: a finite straight line AB.',
  3: 'Circle centred at A, through B.',
  4: 'Circle centred at B, through A.',
  5: 'C is where they cross. Join CA and CB.',
  11: 'ABC is equilateral.',
};

function HeroFigure() {
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [k, setK] = useState(still ? 4 : 0);
  useEffect(() => {
    if (still) return;
    const t = setInterval(() => setK((x) => (x + 1) % STEPS.length), 1300);
    return () => clearInterval(t);
  }, [still]);
  const s = STEPS[k];
  const off = (from: number) => (from <= s ? 0 : 100);
  const seg = (a: typeof A, b: typeof A) => ({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, pathLength: 100 });
  return (
    <div className="hero-fig" aria-hidden="true">
      <svg viewBox="0 0 600 433.3">
        <polygon className="h-fill" points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}`} style={{ opacity: s >= FROM.tri ? 0.9 : 0 }} />
        <circle className="h-circ" cx={A.x} cy={A.y} r={R} pathLength={100} style={{ stroke: 'var(--red)', strokeDashoffset: off(FROM.k1) }} />
        <circle className="h-circ" cx={B.x} cy={B.y} r={R} pathLength={100} style={{ stroke: 'var(--blue)', strokeDashoffset: off(FROM.k2) }} />
        <line className="h-seg" {...seg(A, B)} style={{ stroke: 'var(--ink)', strokeDashoffset: off(FROM.AB) }} />
        <line className="h-seg" {...seg(C, A)} style={{ stroke: 'var(--red)', strokeDashoffset: off(FROM.C) }} />
        <line className="h-seg late" {...seg(C, B)} style={{ stroke: 'var(--blue)', strokeDashoffset: off(FROM.C) }} />
        <circle className="h-dot h-c" cx={C.x} cy={C.y} r={s >= FROM.C ? 6 : 0} />
        <circle className="h-dot" cx={A.x} cy={A.y} r={6} />
        <circle className="h-dot" cx={B.x} cy={B.y} r={6} />
      </svg>
      <p className="cap">I.1 · {NOTES[s]}</p>
    </div>
  );
}

const TOOLS = [
  {
    href: '#/workshop',
    title: 'The workshop',
    shape: { background: 'var(--red)', transform: 'rotate(45deg)' },
    desc: 'Compass-and-straightedge puzzles. You start with Postulates 1–3 only, and every construction you solve becomes a tool for the next one. Solutions are checked on random configurations, the way property-based tests are.',
  },
  {
    href: '#/graph',
    title: 'The dependency graph',
    shape: { background: 'var(--blue)', borderRadius: '50%' },
    desc: 'Every citation Heath prints, as a graph of all 465 propositions. Trace I.47 down to the postulates, or see everything that rests on the parallel postulate.',
  },
  {
    href: '#/explore',
    title: 'Explorations',
    shape: { background: 'var(--yellow)' },
    desc: 'Playgrounds that go beyond the proofs: the same construction in hyperbolic and spherical geometry, Eudoxus’ ratios as a picture, the Euclidean algorithm on lengths, and the five regular solids.',
  },
  {
    href: '#/glossary',
    title: 'Glossary',
    shape: { background: 'var(--ink)', borderRadius: '6px', transform: 'rotate(12deg)' },
    desc: 'Heath’s vocabulary in modern terms: gnomon, application of areas, duplicate ratio, “measures”, and when “equal” means equal in area.',
  },
];

const PLANE_COLOURS = ['var(--red)', 'var(--yellow)', 'var(--blue)'];

export function Home() {
  const read = useStore(readStore);
  return (
    <div className="page home">
      <header className="hero">
        <div>
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
          </div>
        </div>
        <HeroFigure />
      </header>

      <section aria-label="The thirteen books">
        <div className="home-h">
          <h2>Thirteen books</h2>
          <span>{propositions.length} propositions</span>
        </div>
        <div className="books-grid">
          {BOOKS.map((b, i) => {
            const n = i + 1;
            const items = index.filter((e) => e.book === n && e.kind === 'prop');
            const done = items.filter((e) => read[e.id]).length;
            return (
              <a key={n} className="book-card" href={`#/book/${n}`}>
                <span className={`book-shape ${b.theme}`} style={b.theme === 'plane' ? { ['--c' as string]: PLANE_COLOURS[i % 3] } : undefined} aria-hidden="true" />
                <span className="book-roman">{ROMAN[n]}</span>
                <span className="book-grow" />
                <span className="book-title">{b.title}</span>
                <span className="book-meta">
                  {items.length} propositions
                  {done > 0 && <span className="progress"> · {done} visited</span>}
                </span>
              </a>
            );
          })}
        </div>
      </section>

      <section className="home-tools" aria-label="Tools">
        {TOOLS.map((t) => (
          <a key={t.href} className="tool-card" href={t.href}>
            <span className="tool-icon" style={t.shape} aria-hidden="true" />
            <span className="tool-title">{t.title}</span>
            <span className="tool-desc">{t.desc}</span>
          </a>
        ))}
      </section>
    </div>
  );
}
