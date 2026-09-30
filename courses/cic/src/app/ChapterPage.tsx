import { useParams, useLocation, A } from '@solidjs/router';
import { For, Show, Suspense, createEffect, createResource, ErrorBoundary } from 'solid-js';
import { chapterBySlug, neighbours, parts, fileName } from '../content/chapters.ts';
import { mdxComponents } from '../content/mdx-components.tsx';
import { markVisited } from './progress.ts';
import { PAP, papHref } from '../content/pap.ts';

export function ChapterPage() {
  const params = useParams();
  const loc = useLocation();
  const info = () => chapterBySlug(params.slug!);
  const [mod] = createResource(() => params.slug, async (slug) => {
    const c = chapterBySlug(slug);
    if (!c) return undefined;
    return (await c.load()).default;
  });

  createEffect(() => {
    const m = mod();
    const slug = params.slug;
    if (!m || !slug) return;
    markVisited(slug);
    // once rendered, jump to the requested section (…?s=heading-id), or to the top
    requestAnimationFrame(() => {
      const s = new URLSearchParams(loc.search).get('s');
      if (s) document.getElementById(s)?.scrollIntoView();
      else window.scrollTo(0, 0);
    });
  });

  return (
    <div class="page">
      <article class="prose">
        <Show when={info()} fallback={<p>Unknown chapter.</p>}>
          <header class="chapter-head">
            <div class="chapter-kicker">
              {'-- '}
              {info()!.num > 0 ? `Chapter ${info()!.num}` : 'Prologue'}
              {info()!.part > 0 ? ` · Part ${['', 'I', 'II', 'III', 'IV', 'V'][info()!.part]}: ${parts[info()!.part].title}` : ''}
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
          <Show when={PAP[params.slug!]?.length}>
            <aside class="callout pap-bridge">
              <div class="callout-title">In practice · Proofs Are Programs</div>
              <p>The companion course programs and proves with the ideas of this chapter:</p>
              <ul>
                <For each={PAP[params.slug!]}>
                  {(l) => (
                    <li>
                      <a href={papHref(l.slug)}>
                        {l.num > 0 ? `Chapter ${l.num}` : 'Prologue'}: {l.title}
                      </a>{' '}
                      <span class="muted">({l.what})</span>
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
                  <span class="dir">← {fileName(p())}</span>
                  {p().title}
                </A>
              )}
            </Show>
            <Show when={neighbours(params.slug!).next}>
              {(n) => (
                <A href={`/ch/${n().slug}`} class="next">
                  <span class="dir">{fileName(n())} →</span>
                  {n().title}
                </A>
              )}
            </Show>
          </nav>
        </Show>
      </article>
    </div>
  );
}
