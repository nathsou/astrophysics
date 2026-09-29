import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
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

const nextTheme = (t: Theme): Theme => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system');

function TopBar({ route, onSearch }: { route: Route; onSearch: () => void }) {
  const theme = useStore(themeStore);
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [route]);
  const cycle = () => {
    const next = nextTheme(theme);
    themeStore.set(next);
    applyTheme(next);
  };
  const book = route.page === 'book' ? route.n : route.page === 'item' ? byId.get(route.id)!.book : 0;
  const nav = (page: Route['page'], href: string, label: string) => (
    <a className={route.page === page ? 'on' : ''} href={href}>
      {label}
    </a>
  );
  return (
    <header className="topbar">
      <a className="brand" href="#/">
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <path d="M5 26 L16 7 L27 26 Z" fill="var(--yellow)" stroke="var(--ink)" strokeWidth="1.4" />
          <path d="M5 26 L16 7" stroke="var(--red)" strokeWidth="2.6" />
          <path d="M16 7 L27 26" stroke="var(--blue)" strokeWidth="2.6" />
        </svg>
        <span className="brand-title">Elements</span>
      </a>
      {book > 0 && (
        <nav className="crumbs" aria-label="Breadcrumb">
          <span>/</span>
          {route.page === 'book' ? (
            <span className="here">Book {ROMAN[book]}</span>
          ) : (
            <>
              <a className="lvl" href={`#/book/${book}`}>Book {ROMAN[book]}</a>
              <span className="lvl">/</span>
              <span className="here">{citeLabel((route as { id: string }).id)}</span>
            </>
          )}
        </nav>
      )}
      <span className="spacer" />
      <button className="search-pill" onClick={onSearch} aria-label="Jump to a proposition, or search">
        <span className="txt">Jump to I.47, or search</span>
        <span className="grow" />
        <span className="kbd" aria-hidden="true">{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</span>
        <span className="mag" aria-hidden="true" />
      </button>
      <nav className={`topnav ${menu ? 'open' : ''}`} aria-label="Sections">
        {nav('workshop', '#/workshop', 'Workshop')}
        {nav('graph', '#/graph', 'Graph')}
        {nav('explore', '#/explore', 'Explore')}
        {menu && nav('glossary', '#/glossary', 'Glossary')}
        {menu && nav('about', '#/about', 'About')}
      </nav>
      <button className="round-btn" onClick={cycle} title={`Theme: ${theme}`} aria-label={`Theme: ${theme}. Click to change.`}>
        <span className={`theme-icon ${theme}`} />
      </button>
      <button className="round-btn menu-btn" onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu}>
        <span className="menu-icon" />
      </button>
    </header>
  );
}

interface Entry {
  key: string;
  href: string;
  num: string;
  title: string;
  go?: string;
}

const PAGES: Entry[] = [
  { key: 'workshop', href: '#/workshop', num: '', title: 'Workshop', go: 'compass and straightedge' },
  { key: 'graph', href: '#/graph', num: '', title: 'Dependency graph', go: 'what rests on what' },
  { key: 'explore', href: '#/explore', num: '', title: 'Explorations', go: 'other geometries, solids' },
  { key: 'glossary', href: '#/glossary', num: '', title: 'Glossary', go: 'Heath’s vocabulary' },
  { key: 'about', href: '#/about', num: '', title: 'About', go: 'sources and method' },
];

function search(q: string): Entry[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return index
    .map((e) => {
      const title = modernTitle(e.id) ?? '';
      const hay = `${title} ${e.text}`.toLowerCase();
      return { e, title, ok: words.every((w) => hay.includes(w)), inTitle: title.toLowerCase().includes(words[0]) };
    })
    .filter((x) => x.ok)
    .sort((a, b) => Number(b.inTitle) - Number(a.inTitle))
    .slice(0, 12)
    .map(({ e, title }) => ({ key: e.id, href: `#/${e.id}`, num: citeLabel(e.id), title: title || e.text }));
}

function Palette({ route, onClose }: { route: Route; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const read = useStore(readStore);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => input.current?.focus(), []);

  const book = route.page === 'book' ? route.n : route.page === 'item' ? byId.get(route.id)!.book : 0;
  const groups = useMemo(() => {
    const t = q.trim();
    const out: { title: string; items: Entry[] }[] = [];
    const ref = parseRef(t);
    if (ref) out.push({ title: 'Go to', items: [{ key: `go:${ref}`, href: `#/${ref}`, num: citeLabel(ref), title: modernTitle(ref) ?? byId.get(ref)!.text }] });
    if (t.length === 0) {
      if (book) {
        const props = index.filter((e) => e.book === book && e.kind === 'prop');
        out.push({
          title: `Book ${ROMAN[book]}: propositions`,
          items: props.map((e) => ({ key: `p:${e.id}`, href: `#/${e.id}`, num: citeLabel(e.id), title: modernTitle(e.id) ?? e.text, go: read[e.id] ? 'visited' : undefined })),
        });
      }
      out.push({ title: 'Books', items: BOOKS.map((b, i) => ({ key: `b:${i}`, href: `#/book/${i + 1}`, num: ROMAN[i + 1], title: b.title })) });
      out.push({ title: 'Pages', items: PAGES });
    } else {
      const pages = PAGES.filter((p) => p.title.toLowerCase().includes(t.toLowerCase()));
      if (pages.length) out.push({ title: 'Pages', items: pages });
      const hits = t.length >= 2 ? search(t).filter((h) => h.key !== ref) : [];
      if (hits.length) out.push({ title: 'Propositions and definitions', items: hits });
    }
    return out;
  }, [q, book, read]);
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    list.current?.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  }, [sel, groups]);

  const open = (e: Entry | undefined) => {
    if (!e) return;
    window.location.hash = e.href;
    onClose();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(flat.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      open(flat[sel]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let k = -1;
  return (
    <div className="palette-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Jump to a proposition, or search" onKeyDown={onKey}>
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Jump to I.47, or search the enunciations…"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={flat[sel] ? `pal-${flat[sel].key}` : undefined}
          aria-label="Go to a proposition, or search the enunciations"
        />
        <div className="palette-list" id="palette-list" role="listbox" ref={list}>
          {flat.length === 0 && <div className="palette-none">No match.</div>}
          {groups.map((g) => (
            <div key={g.title}>
              <div className="palette-h">{g.title}</div>
              {g.items.map((e) => {
                const i = ++k;
                return (
                  <a
                    key={e.key}
                    id={`pal-${e.key}`}
                    href={e.href}
                    role="option"
                    aria-selected={i === sel}
                    className={`palette-item ${i === sel ? 'sel' : ''}`}
                    onMouseMove={() => setSel(i)}
                    onClick={(ev) => {
                      ev.preventDefault();
                      open(e);
                    }}
                  >
                    <span className="num">{e.num}</span>
                    <span className="t">{e.title}</span>
                    {e.go && <span className="go">{e.go}</span>}
                  </a>
                );
              })}
            </div>
          ))}
        </div>
        <div className="palette-foot">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const [palette, setPalette] = useState(false);
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
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  return (
    <div className="app">
      <TopBar route={route} onSearch={() => setPalette(true)} />
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
      <footer className="footer">
        <span>Heath’s 1908 translation, with modern versions and live figures.</span>
        <a href="#/glossary">Glossary</a>
        <a href="#/about">About</a>
      </footer>
      {palette && <Palette route={route} onClose={() => setPalette(false)} />}
    </div>
  );
}
