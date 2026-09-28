import { lazy, Suspense, useEffect, useState } from 'react';
import { applyTheme, themeStore, useStore, type Theme } from './ui/store';
import { byId, citeLabel, index, parseRef, ROMAN } from './text';
import { Home } from './pages/Home';
import { BookPage } from './pages/BookPage';
import { ItemPage } from './pages/ItemPage';
import { BOOKS } from './content/books';
import { modernTitle } from './content/modern';
import { readStore } from './ui/progress';

const GraphPage = lazy(() => import('./pages/GraphPage'));
const Workshop = lazy(() => import('./workshop/Workshop'));
const Explore = lazy(() => import('./pages/Explore'));
const Glossary = lazy(() => import('./pages/Glossary'));
const About = lazy(() => import('./pages/About'));

export type Route =
  | { page: 'home' }
  | { page: 'book'; n: number }
  | { page: 'item'; id: string }
  | { page: 'graph'; params: URLSearchParams }
  | { page: 'workshop'; params: URLSearchParams }
  | { page: 'explore'; name?: string }
  | { page: 'glossary' }
  | { page: 'about' };

function parseRoute(): Route {
  const raw = decodeURIComponent(window.location.hash.replace(/^#\/?/, ''));
  const [path, query] = raw.split('?');
  const params = new URLSearchParams(query ?? '');
  let m: RegExpExecArray | null;
  if ((m = /^book\/(\d+)$/.exec(path)) && Number(m[1]) >= 1 && Number(m[1]) <= 13) return { page: 'book', n: Number(m[1]) };
  if (byId.has(path)) return { page: 'item', id: path };
  if (path === 'graph') return { page: 'graph', params };
  if (path === 'workshop') return { page: 'workshop', params };
  if ((m = /^explore(?:\/([\w-]+))?$/.exec(path))) return { page: 'explore', name: m[1] };
  if (path === 'glossary') return { page: 'glossary' };
  if (path === 'about') return { page: 'about' };
  const ref = parseRef(path);
  if (ref) return { page: 'item', id: ref };
  return { page: 'home' };
}

function useRoute(): Route {
  const [r, setR] = useState(parseRoute);
  useEffect(() => {
    const on = () => setR(parseRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

function Sidebar({ route, open, onNav }: { route: Route; open: boolean; onNav: () => void }) {
  const theme = useStore(themeStore);
  const read = useStore(readStore);
  const cycle = () => {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    themeStore.set(next);
    applyTheme(next);
  };
  const currentBook = route.page === 'book' ? route.n : route.page === 'item' ? byId.get(route.id)!.book : 0;
  const [q, setQ] = useState('');
  const jump = parseRef(q);
  return (
    <nav className={`sidebar ${open ? 'open' : ''}`} aria-label="Contents" onClick={(e) => (e.target as HTMLElement).closest('a') && onNav()}>
      <a className="brand" href="#/">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="30" height="30">
            <path d="M5 26 L16 7 L27 26 Z" fill="var(--byrne-yellow)" stroke="var(--byrne-black)" strokeWidth="1.4" />
            <path d="M5 26 L16 7" stroke="var(--byrne-red)" strokeWidth="2.6" />
            <path d="M16 7 L27 26" stroke="var(--byrne-blue)" strokeWidth="2.6" />
          </svg>
        </span>
        <span>
          <div className="brand-title">Euclid’s Elements</div>
          <div className="brand-sub">Heath’s text, modern versions, live figures</div>
        </span>
      </a>
      <form
        className="jump"
        onSubmit={(e) => {
          e.preventDefault();
          if (jump) {
            window.location.hash = `#/${jump}`;
            setQ('');
            onNav();
          }
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Go to… (e.g. I.47)" aria-label="Go to a proposition" />
        {jump && <button type="submit">{citeLabel(jump)} →</button>}
      </form>
      <div className="sidebar-tools">
        <a className={`chip-btn ${route.page === 'workshop' ? 'on' : ''}`} href="#/workshop">Workshop</a>
        <a className={`chip-btn ${route.page === 'graph' ? 'on' : ''}`} href="#/graph">Graph</a>
        <a className={`chip-btn ${route.page === 'explore' ? 'on' : ''}`} href="#/explore">Explore</a>
        <a className={`chip-btn ${route.page === 'glossary' ? 'on' : ''}`} href="#/glossary">Glossary</a>
        <a className={`chip-btn ${route.page === 'about' ? 'on' : ''}`} href="#/about">About</a>
        <button className="chip-btn" onClick={cycle} title={`Theme: ${theme}`}>
          {theme === 'system' ? '◐' : theme === 'dark' ? '☾' : '☀'}
        </button>
      </div>
      <div className="toc">
        {BOOKS.map((b, i) => {
          const n = i + 1;
          const props = currentBook === n ? index.filter((e) => e.book === n && e.kind === 'prop') : [];
          return (
            <div key={n} className={`toc-book ${currentBook === n ? 'current' : ''}`}>
              <a href={`#/book/${n}`} className={`toc-book-link ${route.page === 'book' && route.n === n ? 'active' : ''}`}>
                <span className="num">{ROMAN[n]}</span>
                <span>{b.title}</span>
              </a>
              {props.length > 0 && (
                <div className="toc-props">
                  {props.map((e) => (
                    <a
                      key={e.id}
                      href={`#/${e.id}`}
                      className={`${route.page === 'item' && route.id === e.id ? 'active' : ''} ${read[e.id] ? 'read' : ''}`}
                      title={modernTitle(e.id) ?? e.text}
                    >
                      <span className="num">{e.n}</span>
                      <span className="t">{modernTitle(e.id) ?? e.text}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export function App() {
  const route = useRoute();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = route.page === 'item' ? `${citeLabel(route.id)}${modernTitle(route.id) ? ' · ' + modernTitle(route.id) : ''} — Euclid’s Elements` : route.page === 'book' ? `Book ${ROMAN[route.n]} — Euclid’s Elements` : 'Euclid’s Elements — an interactive edition';
    document.title = t;
  }, [route]);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => themeStore.get() === 'system' && applyTheme('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return (
    <div className="app">
      <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Contents" aria-expanded={open}>
        ☰
      </button>
      <Sidebar route={route} open={open} onNav={() => setOpen(false)} />
      <main className="main">
        <Suspense fallback={<div className="page muted">Loading…</div>}>
          {route.page === 'home' && <Home />}
          {route.page === 'book' && <BookPage n={route.n} />}
          {route.page === 'item' && <ItemPage key={route.id} id={route.id} />}
          {route.page === 'graph' && <GraphPage params={route.params} />}
          {route.page === 'workshop' && <Workshop params={route.params} />}
          {route.page === 'explore' && <Explore name={route.name} />}
          {route.page === 'glossary' && <Glossary />}
          {route.page === 'about' && <About />}
        </Suspense>
      </main>
    </div>
  );
}
