import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { MDXProvider } from '@mdx-js/react';
import { CHAPTERS, PARTS, chapterBySlug } from './content/course';
import { Tooltip } from './ui/Tooltip';
import { applyTheme, themeStore } from './ui/store';
import { ThemeToggle } from './ui/ThemeToggle';
import { mdxComponents } from './ui/mdx';
import { Home } from './Home';
import { ErrorBoundary } from './ui/ErrorBoundary';

const Playground = lazy(() => import('./viz/Playground').then((m) => ({ default: m.Playground })));

function useRoute() {
  const get = () => window.location.hash.replace(/^#\/?/, '') || '';
  const [r, setR] = useState(get);
  useEffect(() => {
    const on = () => setR(get());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

const chapterCache = new Map<string, ComponentType<any>>();

function Chapter({ slug, anchor }: { slug: string; anchor?: string }) {
  const meta = chapterBySlug(slug);
  const [Comp, setComp] = useState<ComponentType<any> | null>(() => chapterCache.get(slug) ?? null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!meta) return;
    let live = true;
    const c = chapterCache.get(slug);
    if (c) { setComp(() => c); return; }
    setComp(null);
    meta.load().then((m) => {
      chapterCache.set(slug, m.default);
      if (live) setComp(() => m.default);
    }, (e) => live && setErr(String(e)));
    return () => { live = false; };
  }, [slug, meta]);
  useEffect(() => {
    if (!Comp) return;
    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    else window.scrollTo({ top: 0 });
  }, [Comp, anchor]);
  useEffect(() => {
    if (meta) document.title = `${meta.num}. ${meta.short ?? meta.title} · SSA to Silicon`;
  }, [meta]);
  if (!meta) return <div className="article"><h1>Not found</h1><p>No chapter called “{slug}”. <a href="#/">Back to the start</a>.</p></div>;
  const idx = CHAPTERS.indexOf(meta);
  const prev = CHAPTERS[idx - 1], next = CHAPTERS[idx + 1];
  return (
    <article className="article">
      <div className="kicker">{meta.part === 'Appendices' ? `Appendix ${meta.num}` : `Ch ${meta.num.padStart(2, '0')}`} · {meta.stage} · {meta.part}</div>
      <h1>{meta.title}</h1>
      {err && <p className="error-box">Failed to load chapter: {err}</p>}
      {Comp ? <ErrorBoundary label="chapter"><Comp /></ErrorBoundary> : !err && <p className="muted sans">Loading…</p>}
      <nav className="chapter-nav">
        {prev ? <a href={`#/ch/${prev.slug}`}><div className="dir">← Previous</div><div className="ttl">{prev.num}. {prev.short ?? prev.title}</div></a> : <span />}
        {next ? <a href={`#/ch/${next.slug}`} style={{ textAlign: 'right' }}><div className="dir">Next →</div><div className="ttl">{next.num}. {next.short ?? next.title}</div></a> : <span />}
      </nav>
    </article>
  );
}

function Sidebar({ route, open, onNav }: { route: string; open: boolean; onNav: () => void }) {
  const cur = route.startsWith('ch/') ? route.slice(3).split('#')[0] : '';
  return (
    <nav className={`sidebar ${open ? 'open' : ''}`} onClick={(e) => (e.target as HTMLElement).closest('a') && onNav()}>
      <a className="brand" href="#/">
        <span className="logo-mark" aria-hidden="true" />
        <span>
          <div className="brand-title">SSA to Silicon</div>
          <div className="brand-sub">Datasheet · Rev 1.0</div>
        </span>
      </a>
      <div className="sidebar-tools">
        <a className="chip-btn primary" href="#/playground">▶ Playground</a>
        <ThemeToggle />
      </div>
      <div className="toc">
        {PARTS.map((p) => (
          <div key={p}>
            <div className="toc-part">{p}</div>
            {CHAPTERS.filter((c) => c.part === p).map((c) => (
              <a key={c.slug} href={`#/ch/${c.slug}`} className={cur === c.slug ? 'active' : ''}>
                <span className="num">{c.num}</span>
                <span>{c.short ?? c.title}</span>
              </a>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}

export function App() {
  const route = useRoute();
  const [open, setOpen] = useState(false);
  useEffect(() => { applyTheme(themeStore.get(), false); }, []);
  let page;
  if (route.startsWith('ch/')) {
    const [slug, anchor] = route.slice(3).split('#');
    page = <Chapter slug={slug} anchor={anchor} key={slug} />;
  } else if (route.startsWith('playground')) {
    document.title = 'Playground · SSA to Silicon';
    page = <Suspense fallback={<div className="article muted sans">Loading playground…</div>}><Playground /></Suspense>;
  } else {
    document.title = 'SSA to Silicon — an interactive course on compiler backends';
    page = <Home />;
  }
  return (
    <MDXProvider components={mdxComponents}>
      <div className={`app ${route.startsWith('playground') ? 'wide-mode' : route.startsWith('ch/') ? '' : 'home-mode'}`}>
        <a className="skip-link" href="#/" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
        <Sidebar route={route} open={open} onNav={() => setOpen(false)} />
        <main className="main" id="main" tabIndex={-1} style={{ outline: 'none' }}>
          <div className="mobile-bar">
            <button className="chip-btn" onClick={() => setOpen((o) => !o)} aria-label="Open contents" aria-expanded={open}>☰ Contents</button>
            <span className="logo-mark" aria-hidden="true" />
            <span style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>SSA to Silicon</span>
          </div>
          {page}
        </main>
      </div>
      <Tooltip />
    </MDXProvider>
  );
}
