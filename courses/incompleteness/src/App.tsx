import '../../../packages/course-navigation/navigation.css';
import { useEffect, useRef, useState } from 'react';
import { MDXProvider } from '@mdx-js/react';
import { applyTheme, inspectorCollapsed, inspectorStore, reducedMotion, themeStore, useStore, type Theme } from './ui/store';
import { sourceIndex } from './content/source';
import { isInteractive, planOf } from './content/course';
import { mdxComponents } from './ui/mdx';
import { SectionPage } from './pages/SectionPage';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { SearchDialog } from './ui/Search';
import { IndexPage } from './pages/IndexPage';
import { installScrollFocus } from './ui/scrollFocus';
import { chapterStartsOpen, revealInContainer } from './ui/sidebar';

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

function ThemeButton() {
  const theme = useStore(themeStore);
  const cycle = () => {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    themeStore.set(next);
    applyTheme(next);
  };
  return (
    <button className="chip-btn" onClick={cycle} title={`Theme: ${theme}`}>
      {theme === 'system' ? '◐ system' : theme === 'dark' ? '☾ dark' : '☀ light'}
    </button>
  );
}

/** The tools of the title page, which has no sidebar. */
function Topbar({ onSearch }: { onSearch: () => void }) {
  return (
    <div className="topbar">
      <button className="chip-btn search-btn" onClick={onSearch} title="Search (/ or Ctrl+K)">
        ⌕ Search <kbd>/</kbd>
      </button>
      <a className="chip-btn" href="#/index">Index</a>
      <a className="chip-btn" href="#/about">About &amp; sources</a>
      <ThemeButton />
    </div>
  );
}

function Sidebar({ route, open, onNav, onSearch }: { route: Route; open: boolean; onNav: () => void; onSearch: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const loaded = useRef(false);
  // Keep the current section in view: centred on load and whenever the drawer opens; after
  // navigating, only if it is not already visible (so a clicked row does not jump away).
  useEffect(() => {
    const nav = ref.current;
    const link = nav?.querySelector<HTMLAnchorElement>('.toc a.active');
    if (!nav || !link) return;
    const details = link.closest('details');
    if (details && !details.open) details.open = true;
    const first = !loaded.current;
    loaded.current = true;
    const reveal = (force: boolean, smooth: boolean) => revealInContainer(nav, link, { force, smooth });
    reveal(first || open, !first && !reducedMotion());
    // Web fonts can change the rows' heights after the first layout.
    if (first) document.fonts?.ready.then(() => reveal(true, false));
  }, [route.section, open]);
  return (
    <nav ref={ref} id="contents" className={`sidebar ${open ? 'open' : ''}`} aria-label="Contents" onClick={(e) => (e.target as HTMLElement).closest('a') && onNav()}>
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
        <ThemeButton />
      </div>
      <div className="toc">
        {sourceIndex.chapters.map((c) => (
          <details key={c.id} open={chapterStartsOpen(c.sections.map((s) => s.id), route.section)}>
            <summary className="toc-chapter">
              <span className="num">{c.number}</span>
              <span>{c.title}</span>
            </summary>
            {c.sections.map((s) => {
              const interactive = isInteractive(s.id);
              const active = route.section === s.id;
              return (
                <a
                  key={s.id}
                  href={`#/s/${s.id}`}
                  className={`${active ? 'active' : ''} ${interactive ? '' : 'text-only'}`}
                  aria-current={active ? 'page' : undefined}
                  title={planOf(s.id)?.blurb ?? 'The book’s text only (Formal mode)'}
                >
                  <span className="num">{s.number}</span>
                  <span>{s.title}</span>
                  {!interactive && (
                    <span className="text-mark" aria-hidden="true">
                      ¶
                    </span>
                  )}
                  {!interactive && <span className="sr-only"> (the book’s text only)</span>}
                </a>
              );
            })}
          </details>
        ))}
      </div>
      <p className="toc-note">
        <span aria-hidden="true">¶</span> marks the few sections that show only the book’s text; all the others also have Intuition and Explore modes.
      </p>
    </nav>
  );
}

/** On narrow screens the inspector is opened from the top bar, so it never sits over the text. */
function InspectorButton() {
  const collapsed = useStore(inspectorCollapsed);
  const entry = useStore(inspectorStore);
  return (
    <button className={`chip-btn inspector-bar-btn ${entry ? 'has-entry' : ''}`} onClick={() => inspectorCollapsed.set(!collapsed)} aria-expanded={!collapsed} aria-controls="inspector">
      Inspector
    </button>
  );
}

export function App() {
  const route = useRoute();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  useEffect(() => applyTheme(themeStore.get(), false), []);
  useEffect(() => {
    const main = document.getElementById('main');
    return main ? installScrollFocus(main) : undefined;
  }, []);
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
  const landing = route.page === 'home';
  return (
    <MDXProvider components={mdxComponents}>
      <nav className="course-index-nav" aria-label="Course collection">
        <a className="course-index-link" href="../"><span aria-hidden="true">←</span> All courses</a>
      </nav>
      <a className="skip" href="#main">Skip to content</a>
      <div className={`app${landing ? ' landing' : ''}`}>
        {!landing && <Sidebar route={route} open={open} onNav={() => setOpen(false)} onSearch={() => setSearching(true)} />}
        <main className="main" id="main">
          {landing && <Topbar onSearch={() => setSearching(true)} />}
          {!landing && <div className="mobile-bar">
            <button className="chip-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="contents">
              ☰ Contents
            </button>
            <span>Incompleteness and Computability</span>
            <button className="chip-btn" onClick={() => setSearching(true)} aria-label="Search">
              ⌕ Search
            </button>
            {route.page === 'section' && <InspectorButton />}
          </div>}
          {page}
        </main>
      </div>
      <SearchDialog open={searching} onClose={() => setSearching(false)} />
    </MDXProvider>
  );
}
