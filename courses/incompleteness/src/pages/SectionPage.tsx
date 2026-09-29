import { useEffect, useMemo, useState, type ComponentType } from 'react';
import type { Chapter } from '../content/schema';
import { chapterOf, loadChapter, sourceIndex, sourceUrl } from '../content/source';
import { planOf, type Mode, type SectionPlan } from '../content/course';
import { FormalBlocks, Inlines, anchor, type Annotations } from '../formal/FormalText';
import { Inspector } from '../ui/Inspector';
import { ObjectBar } from '../ui/ObjectBar';
import { persist, persisted } from '../ui/store';
import { Attribution } from './Attribution';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { recordVisit } from '../ui/progress';

const MODE_INFO: Record<Mode, { label: string; key: string; blurb: string }> = {
  intuition: { label: 'Intuition', key: 'i', blurb: 'Motivation, concrete examples and the idea behind the formal development.' },
  explore: { label: 'Explore', key: 'e', blurb: 'A workbench: construct the object, inspect it, step through what happens to it. Everything shown is computed for your input.' },
  formal: { label: 'Formal', key: 'f', blurb: 'The definitions, theorems and proofs — with your object worked through where the text defines or uses it.' },
};

function useLazy<T>(loader: (() => Promise<T>) | undefined): T | null {
  const [mod, setMod] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    setMod(null);
    loader?.().then((m) => live && setMod(() => m));
    return () => {
      live = false;
    };
  }, [loader]);
  return mod;
}

export function SectionPage({ id, params }: { id: string; params: URLSearchParams }) {
  const plan = planOf(id);
  const meta = chapterOf(id);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!meta) return;
    loadChapter(meta.id).then(setChapter, (e) => setError(String(e)));
  }, [meta]);
  const section = chapter?.sections.find((s) => s.id === id);

  const available: Mode[] = [plan?.intuition && 'intuition', plan?.explore && 'explore', 'formal'].filter(Boolean) as Mode[];
  const requested = params.get('mode') as Mode | null;
  const stored = persisted<Mode | null>(`ic.mode.${id}`, null);
  const mode: Mode = requested && available.includes(requested) ? requested : stored && available.includes(stored) ? stored : available[0];
  const setMode = (m: Mode) => {
    persist(`ic.mode.${id}`, m);
    history.replaceState(null, '', `#/s/${id}?mode=${m}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  // Keyboard: i / e / f switch modes (not while typing).
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea, select, [contenteditable]')) return;
      const m = (Object.keys(MODE_INFO) as Mode[]).find((k) => MODE_INFO[k].key === e.key);
      if (m && available.includes(m)) setMode(m);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  // Scroll to a cross-referenced block.
  const at = params.get('at');
  useEffect(() => {
    if (!section) return;
    if (at) {
      requestAnimationFrame(() => {
        const el = document.getElementById(at);
        if (el) {
          el.scrollIntoView({ block: 'start' });
          el.classList.add('flash');
          setTimeout(() => el.classList.remove('flash'), 1600);
        }
      });
    } else window.scrollTo({ top: 0 });
  }, [section, at, mode]);

  useEffect(() => {
    if (meta) recordVisit(id);
  }, [id, meta]);

  useEffect(() => {
    if (section) document.title = `${section.number} ${section.titleText} · Incompleteness and Computability`;
  }, [section]);

  const flat = useMemo(() => sourceIndex.chapters.flatMap((c) => c.sections.map((s) => ({ ...s, chapter: c }))), []);
  const idx = flat.findIndex((s) => s.id === id);
  const prev = flat[idx - 1];
  const next = flat[idx + 1];

  if (!meta) {
    return (
      <div className="page no-inspector">
        <div className="column">
          <h1>Not found</h1>
          <p>
            There is no section “{id}”. <a href="#/">Back to the contents</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="column">
        <header className="section-head">
          <div className="kicker">
            Chapter {meta.number} · {meta.title}
          </div>
          <h1>
            <span className="sec-num">{section?.number ?? ''}</span> {section ? <Inlines c={section.title} /> : '…'}
          </h1>
          <div className="mode-row">
            <div className="modes" role="tablist" aria-label="Mode">
              {(Object.keys(MODE_INFO) as Mode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  aria-controls="mode-panel"
                  disabled={!available.includes(m)}
                  title={available.includes(m) ? `${MODE_INFO[m].label} (${MODE_INFO[m].key})` : 'Not available for this section yet: it shows the book’s text only'}
                  onClick={() => setMode(m)}
                >
                  {MODE_INFO[m].label} <kbd aria-hidden="true">{MODE_INFO[m].key}</kbd>
                </button>
              ))}
            </div>
            {section && (
              <a className="chip-btn" href={sourceUrl(section.loc)} target="_blank" rel="noreferrer" title="The LaTeX source of this section, at the pinned commit">
                ¶ source
              </a>
            )}
          </div>
          <p className="mode-blurb">{MODE_INFO[mode].blurb}</p>
          {plan?.object && <ObjectBar kind={plan.object} />}
        </header>

        <div id="mode-panel" role="tabpanel" aria-label={MODE_INFO[mode].label}>
          {error && <p className="error-box">Could not load the text: {error}</p>}
          <ErrorBoundary key={mode}>
            {mode === 'intuition' && <LazyMdx loader={plan?.intuition} />}
            {mode === 'explore' && <LazyMdx loader={plan?.explore} />}
            {mode === 'formal' && section && <Formal plan={plan} sectionId={id} chapter={chapter!} />}
          </ErrorBoundary>
        </div>

        <nav className="pager" aria-label="Previous and next section">
          {prev ? (
            <a href={`#/s/${prev.id}`}>
              <div className="dir">← Previous</div>
              <div>
                {prev.number} {prev.title}
              </div>
            </a>
          ) : (
            <span />
          )}
          {next ? (
            <a href={`#/s/${next.id}`} style={{ textAlign: 'right' }}>
              <div className="dir">Next →</div>
              <div>
                {next.number} {next.title}
              </div>
            </a>
          ) : (
            <span />
          )}
        </nav>
        <Attribution section={section ? { loc: section.loc, title: section.titleText } : undefined} />
      </div>
      <div className="inspector-col">
        <Inspector />
      </div>
    </div>
  );
}

function LazyMdx({ loader }: { loader?: () => Promise<{ default: ComponentType }> }) {
  const mod = useLazy(loader);
  if (!loader) return null;
  if (!mod) return <p className="muted sans">Loading…</p>;
  const C = mod.default;
  return (
    <div className="prose">
      <C />
    </div>
  );
}

function Formal({ plan, sectionId, chapter }: { plan?: SectionPlan; sectionId: string; chapter: Chapter }) {
  const ann = useLazy(plan?.annotations);
  const section = chapter.sections.find((s) => s.id === sectionId)!;
  if (plan?.annotations && !ann) return <p className="muted sans">Loading…</p>;
  return (
    <div className="formal">
      {ann ? <AnnotatedBlocks sectionId={sectionId} blocks={section.blocks} useAnnotations={ann.useAnnotations} /> : <FormalBlocks blocks={section.blocks} ctx={{ sectionId }} />}
      {sectionId === chapter.sections[chapter.sections.length - 1].id && chapter.summary && (
        <section className="chapter-summary" id={anchor(`${chapter.id}.summary`)}>
          <h2>Chapter summary</h2>
          <FormalBlocks blocks={chapter.summary} ctx={{ sectionId }} />
        </section>
      )}
    </div>
  );
}

function AnnotatedBlocks({ sectionId, blocks, useAnnotations }: { sectionId: string; blocks: Chapter['sections'][number]['blocks']; useAnnotations: () => Annotations }) {
  const annotations = useAnnotations();
  return <FormalBlocks blocks={blocks} ctx={{ sectionId, annotations }} />;
}
