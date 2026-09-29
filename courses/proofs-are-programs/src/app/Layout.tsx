import { A, useLocation, type RouteSectionProps } from '@solidjs/router';
import { For, Show, createSignal, createEffect, onCleanup, onMount } from 'solid-js';
import { chapters, parts, chapterBySlug, romans, chapterLabel } from '../content/chapters.ts';
import { cycleTheme, theme } from './theme.ts';
import { isVisited } from './progress.ts';

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
  const themeIcon = () => (theme() === 'dark' ? '☾' : theme() === 'light' ? '☀' : '◐');
  const partLabel = (n: number) => (n === 0 || n === 7 ? parts[n].title : `Part ${romans[n]} · ${parts[n].title}`);

  return (
    <div class="shell">
      <nav class={`sidebar ${open() ? 'open' : ''}`} aria-label="Course contents">
        <A href="/" class="brand">
          <span class="brand-mark">⊢</span>
          <span class="brand-text">
            <b>Proofs Are Programs</b>
            <span>the Curry–Howard correspondence, for programmers</span>
          </span>
        </A>
        <For each={parts}>
          {(p) => (
            <div class="nav-part">
              <span class="label">{partLabel(p.num)}</span>
              <For each={chapters.filter((c) => c.part === p.num)}>
                {(c) => (
                  <A href={`/ch/${c.slug}`} class="nav-link" activeClass="active" end>
                    <span class="num">{c.part === 0 || c.part === 7 ? '' : c.num}</span>
                    <span>{c.title}</span>
                    <Show when={isVisited(c.slug)}>
                      <span class="dot" title="visited" />
                    </Show>
                  </A>
                )}
              </For>
            </div>
          )}
        </For>
        <div class="nav-extra">
          <span class="label" style={{ padding: '0.3rem 0.55rem', display: 'block' }}>
            Tools & reference
          </span>
          <A href="/playground" class="nav-link" activeClass="active">
            <span class="num">⌨</span>Playground
          </A>
          <A href="/reference/tactics" class="nav-link" activeClass="active">
            <span class="num">▸</span>Tactic reference
          </A>
          <A href="/reference/language" class="nav-link" activeClass="active">
            <span class="num">λ</span>Language reference
          </A>
          <A href="/reference/dictionary" class="nav-link" activeClass="active">
            <span class="num">≅</span>Curry–Howard dictionary
          </A>
          <A href="/reference/bridges" class="nav-link" activeClass="active">
            <span class="num">⇄</span>The CIC course, chapter by chapter
          </A>
          <A href="/reference/glossary" class="nav-link" activeClass="active">
            <span class="num">¶</span>Glossary
          </A>
          <A href="/reference/reading" class="nav-link" activeClass="active">
            <span class="num">❡</span>Further reading
          </A>
        </div>
      </nav>
      <Show when={open()}>
        <div class="scrim" onClick={() => setOpen(false)} />
      </Show>
      <div class="main">
        <header class="topbar">
          <button class="btn ghost small menu-btn" onClick={() => setOpen(!open())} aria-label="open contents">
            ☰
          </button>
          <span class="crumb">
            <Show when={current()} fallback={<b>{loc.pathname.startsWith('/playground') ? 'Playground' : loc.pathname.startsWith('/reference') ? 'Reference' : 'Home'}</b>}>
              {current()!.part > 0 && current()!.part < 7 ? `${chapterLabel(current()!)} · ` : ''}
              <b>{current()!.title}</b>
            </Show>
          </span>
          <span class="grow" />
          <A href="/playground" class="btn small ghost">
            Playground
          </A>
          <button class="btn small ghost" onClick={cycleTheme} title={`theme: ${theme()}`} aria-label="toggle colour theme">
            {themeIcon()}
          </button>
          <Show when={current()}>
            <div class="progress-bar" style={{ width: `${scroll() * 100}%` }} />
          </Show>
        </header>
        {props.children}
      </div>
    </div>
  );
}
