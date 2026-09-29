import { A, useLocation, type RouteSectionProps } from '@solidjs/router';
import { For, Show, createSignal, createEffect, onCleanup, onMount } from 'solid-js';
import { chapters, parts, chapterBySlug, fileName, baseFileName } from '../content/chapters.ts';
import { cycleTheme, theme, palette, setPalette } from './theme.ts';
import { isVisited } from './progress.ts';

const REFERENCE_FILES: Record<string, string> = { rules: 'rule_index.md', timeline: 'timeline.md', glossary: 'glossary.md', bibliography: 'further_reading.md' };
const PART_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

export function Layout(props: RouteSectionProps) {
  const [open, setOpen] = createSignal(false);
  const [scroll, setScroll] = createSignal(0);
  const loc = useLocation();
  const slug = () => /^\/ch\/([^/?]+)/.exec(loc.pathname)?.[1];
  const current = () => (slug() ? chapterBySlug(slug()!) : undefined);
  createEffect(() => {
    void loc.pathname;
    setOpen(false);
  });
  onMount(() => {
    const on = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setScroll(h > 0 ? window.scrollY / h : 0);
    };
    window.addEventListener('scroll', on, { passive: true });
    onCleanup(() => window.removeEventListener('scroll', on));
  });
  const refPage = () => /^\/reference\/([^/?]+)/.exec(loc.pathname)?.[1];
  /** the file shown in the second tab */
  const tabName = () => {
    if (current()) return fileName(current()!);
    if (loc.pathname.startsWith('/playground')) return 'playground.lean';
    if (refPage()) return REFERENCE_FILES[refPage()!] ?? `${refPage()}.md`;
    return undefined;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open()) setOpen(false);
  };
  onMount(() => {
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });
  const themeIcon = () => (theme() === 'dark' ? '☾' : theme() === 'light' ? '☀' : '◐');

  return (
    <div class="shell">
      <a
        href="#main"
        class="skip-link"
        onClick={(e) => {
          // hash routing: do not let the browser replace the route with "#main"
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <nav class={`sidebar ${open() ? 'open' : ''}`} id="contents" aria-label="Course contents">
        <A href="/" class="brand" title="Calculus of Inductive Constructions: welcome">
          CIC <span class="brand-count">/ {chapters.length} chapters</span>
          <span class="brand-read">
            ✓ {chapters.filter((c) => isVisited(c.slug)).length} / {chapters.length} read
          </span>
        </A>
        <For each={parts}>
          {(p) => (
            <div class="nav-part">
              <span class="label">{p.num === 0 ? `-- ${p.title}` : `-- ${PART_ROMAN[p.num]} · ${p.title}`}</span>
              <For each={chapters.filter((c) => c.part === p.num)}>
                {(c) => (
                  <A href={`/ch/${c.slug}`} class="nav-link" activeClass="active" end title={c.title}>
                    <span class="num">{String(c.num).padStart(2, '0')}</span>
                    {baseFileName(c)}
                    <span class="sr-only"> — {c.title}</span>
                    <Show when={isVisited(c.slug)}>
                      <span class="dot" title="visited" role="img" aria-label="visited" />
                    </Show>
                  </A>
                )}
              </For>
            </div>
          )}
        </For>
        <div class="nav-extra">
          <span class="label" style={{ padding: '0.5rem 1.1rem 0.15rem', display: 'block' }}>
            -- tools & reference
          </span>
          <A href="/playground" class="nav-link" activeClass="active" title="Playground">
            <span class="num sym">⌨</span>playground.lean
          </A>
          <A href="/reference/rules" class="nav-link" activeClass="active" title="Rule index">
            <span class="num sym">⊢</span>rule_index.md
          </A>
          <A href="/reference/timeline" class="nav-link" activeClass="active" title="Timeline">
            <span class="num sym">⌛</span>timeline.md
          </A>
          <A href="/reference/glossary" class="nav-link" activeClass="active" title="Glossary">
            <span class="num sym">¶</span>glossary.md
          </A>
          <A href="/reference/bibliography" class="nav-link" activeClass="active" title="Further reading">
            <span class="num sym">❡</span>further_reading.md
          </A>
        </div>
      </nav>
      <Show when={open()}>
        <div class="scrim" onClick={() => setOpen(false)} />
      </Show>
      <div class="main">
        <header class="topbar">
          <button class="btn ghost small menu-btn" onClick={() => setOpen(!open())} aria-label="Contents" aria-expanded={open()} aria-controls="contents">
            ☰
          </button>
          <div class="tabs">
            <A href="/" class={`tab tab-home ${tabName() ? '' : 'active'}`} aria-current={tabName() ? undefined : 'page'} end>
              <span>00_welcome.lean</span>
            </A>
            <Show when={tabName()}>
              <span class="tab active" aria-current="page" title={current()?.title}>
                <span>{tabName()}</span>
              </span>
            </Show>
          </div>
          <div class="tab-actions">
            <A href="/playground" class="btn small ghost" aria-label="Playground" title="Playground">
              <span aria-hidden="true">⌨</span>
              <span class="btn-text">playground</span>
            </A>
            <button
              class="btn small ghost palette-btn"
              onClick={() => setPalette(palette() === 'paper' ? 'lilac' : 'paper')}
              aria-pressed={palette() === 'paper'}
              aria-label="Paper background"
              title={palette() === 'paper' ? 'background: paper (click for lilac)' : 'background: lilac (click for paper)'}
            >
              <span class="palette-swatch" aria-hidden="true" />
            </button>
            <button class="btn small ghost" onClick={cycleTheme} title={`theme: ${theme()}`} aria-label={`Colour theme: ${theme()}. Click to change.`}>
              {themeIcon()}
            </button>
          </div>
          <Show when={current()}>
            <div class="progress-bar" style={{ width: `${scroll() * 100}%` }} />
          </Show>
        </header>
        <main id="main" tabindex="-1">
          {props.children}
        </main>
      </div>
    </div>
  );
}
