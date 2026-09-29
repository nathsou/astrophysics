import { useParams, useLocation, A } from '@solidjs/router';
import { For, Show, Suspense, createEffect, createResource, createSignal, onCleanup, ErrorBoundary } from 'solid-js';
import { chapterBySlug, neighbours, parts, romans, chapterLabel } from '../content/chapters.ts';
import { mdxComponents } from '../content/mdx-components.tsx';
import { markVisited, cicVisited } from './progress.ts';
import { cicHref } from '../content/bridges.ts';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function ChapterPage() {
  const params = useParams();
  const loc = useLocation();
  const info = () => chapterBySlug(params.slug!);
  const [mod] = createResource(() => params.slug, async (slug) => {
    const c = chapterBySlug(slug);
    if (!c) return undefined;
    return (await c.load()).default;
  });
  const [toc, setToc] = createSignal<TocItem[]>([]);
  const [currentId, setCurrentId] = createSignal<string>();
  let article!: HTMLElement;
  let observer: IntersectionObserver | undefined;

  createEffect(() => {
    const m = mod();
    const slug = params.slug;
    if (!m || !slug) return;
    markVisited(slug);
    // collect headings once rendered
    requestAnimationFrame(() => {
      const hs = [...article.querySelectorAll('h2[id], h3[id]')] as HTMLElement[];
      setToc(hs.map((h) => ({ id: h.id, text: (h.textContent ?? '').replace(/#$/, ''), level: h.tagName === 'H2' ? 2 : 3 })));
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) if (e.isIntersecting) setCurrentId(e.target.id);
        },
        { rootMargin: '-80px 0px -70% 0px' },
      );
      hs.forEach((h) => observer!.observe(h));
      const s = new URLSearchParams(loc.search).get('s');
      if (s) document.getElementById(s)?.scrollIntoView();
      else window.scrollTo(0, 0);
    });
  });
  onCleanup(() => observer?.disconnect());

  const jump = (id: string) => {
    history.replaceState(null, '', `#/ch/${params.slug}?s=${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div class="page">
      <article class="prose" ref={article}>
        <Show when={info()} fallback={<p>Unknown chapter.</p>}>
          <header class="chapter-head">
            <div class="chapter-kicker">
              {chapterLabel(info()!)}
              {info()!.part > 0 && info()!.part < 7 ? ` · Part ${romans[info()!.part]}: ${parts[info()!.part].title}` : ''}
            </div>
            <h1>{info()!.title}</h1>
            <p class="chapter-blurb">{info()!.blurb}</p>
          </header>
          <ErrorBoundary fallback={(err) => <div class="callout warning">This chapter failed to render: {String(err)}</div>}>
            <Suspense
              fallback={
                <div class="loading">
                  <div class="spinner" />
                </div>
              }
            >
              <Show when={mod()} keyed>
                {(M) => M({ components: mdxComponents })}
              </Show>
            </Suspense>
          </ErrorBoundary>
          <Show when={info()!.cic?.length}>
            <aside class="bridge-box">
              <div class="bridge-title">Under the hood · in the CIC course</div>
              <p class="bridge-lead">This chapter uses the type checker; these chapters of <em>The Calculus of Inductive Constructions</em> explain how it works.</p>
              <ul>
                <For each={info()!.cic}>
                  {(l) => (
                    <li>
                      <a href={cicHref(l.slug, l.s)}>{l.what}</a>
                      <Show when={cicVisited(l.slug)}>
                        <span class="badge ok" style={{ 'margin-left': '0.4rem' }}>
                          read
                        </span>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </aside>
          </Show>
          <nav class="chapter-nav">
            <Show when={neighbours(params.slug!).prev}>
              {(p) => (
                <A href={`/ch/${p().slug}`}>
                  <span class="dir">← Previous</span>
                  {p().title}
                </A>
              )}
            </Show>
            <Show when={neighbours(params.slug!).next}>
              {(n) => (
                <A href={`/ch/${n().slug}`} class="next">
                  <span class="dir">Next →</span>
                  {n().title}
                </A>
              )}
            </Show>
          </nav>
        </Show>
      </article>
      <aside class="page-toc" aria-label="On this page">
        <div class="label" style={{ 'margin-bottom': '0.5rem' }}>
          On this page
        </div>
        <For each={toc()}>
          {(t) => (
            <a
              href={`#/ch/${params.slug}?s=${t.id}`}
              class={`${t.level === 3 ? 'h3' : ''} ${currentId() === t.id ? 'current' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                jump(t.id);
              }}
            >
              {t.text}
            </a>
          )}
        </For>
      </aside>
    </div>
  );
}
