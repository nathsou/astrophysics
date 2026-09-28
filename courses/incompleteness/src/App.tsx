import { useEffect, useState } from 'react';
import { MDXProvider } from '@mdx-js/react';
import { applyTheme, themeStore, useStore, type Theme } from './ui/store';
import { sourceIndex } from './content/source';
import { isInteractive, planOf } from './content/course';
import { mdxComponents } from './ui/mdx';
import { SectionPage } from './pages/SectionPage';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { SearchDialog } from './ui/Search';
import { IndexPage } from './pages/IndexPage';

export interface Route {
  page: 'home' | 'about' | 'index' | 'section';
  section?: string;
  params: URLSearchParams;
}

function parseRoute(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  const params = new URLSearchParams(query ?? '');
  if (path.startsWith('s/')) return { page: 'section', section: path.slice(2), params };
  if (path === 'about') return { page: 'about', params };
  if (path === 'index') return { page: 'index', params };
  return { page: 'home', params };
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

function Sidebar({ route, open, onNav, onSearch }: { route: Route; open: boolean; onNav: () => void; onSearch: () => void }) {
  const theme = useStore(themeStore);
  const cycle = () => {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    themeStore.set(next);
    applyTheme(next);
  };
  return (
    <nav className={`sidebar ${open ? 'open' : ''}`} aria-label="Contents" onClick={(e) => (e.target as HTMLElement).closest('a') && onNav()}>
      <a className="brand" href="#/">
        <span className="brand-mark" aria-hidden="true">⌜⌝</span>
        <span>
          <div className="brand-title">Incompleteness and Computability</div>
          <div className="brand-sub">an executable edition of Richard Zach’s text</div>
        </span>
      </a>
      <div className="sidebar-tools">
        <button className="chip-btn search-btn" onClick={onSearch} title="Search (/ or Ctrl+K)">
          ⌕ Search <kbd>/</kbd>
        </button>
        <a className="chip-btn" href="#/index">Index</a>
        <a className="chip-btn" href="#/about">About &amp; sources</a>
        <button className="chip-btn" onClick={cycle} title={`Theme: ${theme}`}>
          {theme === 'system' ? '◐ system' : theme === 'dark' ? '☾ dark' : '☀ light'}
        </button>
      </div>
      <div className="toc">
        {sourceIndex.chapters.map((c) => {
          const current = c.sections.some((s) => s.id === route.section);
          const hasInteractive = c.sections.some((s) => isInteractive(s.id));
          return (
            <details key={c.id} open={current || hasInteractive}>
              <summary className="toc-chapter">
                <span className="num">{c.number}</span>
                <span>{c.title}</span>
              </summary>
              {c.sections.map((s) => {
                const interactive = isInteractive(s.id);
                return (
                  <a key={s.id} href={`#/s/${s.id}`} className={`${route.section === s.id ? 'active' : ''} ${interactive ? '' : 'text-only'}`} title={planOf(s.id)?.blurb ?? 'The book’s text (Formal mode)'}>
                    <span className="num">{s.number}</span>
                    <span>{s.title}</span>
                    {interactive && <span className="dot" aria-label="interactive" />}
                  </a>
                );
              })}
            </details>
          );
        })}
      </div>
      <p className="toc-note">
        <span className="dot-inline" /> sections with intuition and workbench modes. The others show the book’s text.
      </p>
    </nav>
  );
}

export function App() {
  const route = useRoute();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  useEffect(() => applyTheme(themeStore.get(), false), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        e.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  let page;
  if (route.page === 'section' && route.section) page = <SectionPage key={route.section} id={route.section} params={route.params} />;
  else if (route.page === 'about') page = <About />;
  else if (route.page === 'index') page = <IndexPage />;
  else page = <Home />;
  return (
    <MDXProvider components={mdxComponents}>
      <a className="skip" href="#main">Skip to content</a>
      <div className="app">
        <Sidebar route={route} open={open} onNav={() => setOpen(false)} onSearch={() => setSearching(true)} />
        <main className="main" id="main">
          <div className="mobile-bar">
            <button className="chip-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              ☰ Contents
            </button>
            <span>Incompleteness and Computability</span>
            <button className="chip-btn" onClick={() => setSearching(true)} aria-label="Search">
              ⌕ Search
            </button>
          </div>
          {page}
        </main>
      </div>
      <SearchDialog open={searching} onClose={() => setSearching(false)} />
    </MDXProvider>
  );
}
