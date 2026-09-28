// One item of the Elements: a proposition (with its figure), a definition, a postulate or a common notion.

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { FigureView, type Bus } from '../geometry/FigureView';
import type { FigureDef } from '../geometry/figure';
import { paragraphMentions } from '../geometry/reveal';
import { resolve, type Kind } from '../geometry/resolve';
import { byId, citeLabel, hrefOf, loadItem, longLabel, nextId, prevId, ROMAN } from '../text';
import type { Item } from '../text/types';
import { loadFigure } from '../content/figures';
import { loadModern, splitFrontMatter } from '../content/modern';
import { HeathText, renderInlines } from '../ui/HeathText';
import { Markdown } from '../ui/Markdown';
import { Cite } from '../ui/Cite';
import { byrneStore, hoverStore, textModeStore, useStore, type TextMode } from '../ui/store';
import { citedBy, cites, depth, usesParallelPostulate } from '../graph/deps';
import { markRead } from '../ui/progress';

export function ItemPage({ id }: { id: string }) {
  const [item, setItem] = useState<Item | null>(null);
  const [fig, setFig] = useState<FigureDef | null | undefined>(undefined);
  const [modern, setModern] = useState<{ meta: Record<string, string>; body: string } | null | undefined>(undefined);
  const [bus, setBus] = useState<Bus | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const mode = useStore(textModeStore);
  const byrne = useStore(byrneStore);
  const hoverKey = useStore(hoverStore);

  useEffect(() => {
    let live = true;
    setItem(null);
    setFig(undefined);
    setModern(undefined);
    setBus(null);
    setStep(null);
    void loadItem(id).then((it) => live && setItem(it ?? null));
    void loadFigure(id).then((f) => live && setFig(f ?? null));
    void loadModern(id).then((m) => live && setModern(m ? splitFrontMatter(m) : null));
    window.scrollTo(0, 0);
    markRead(id);
    return () => {
      live = false;
    };
  }, [id]);

  const mentions = useMemo(() => (item ? paragraphMentions(item.paras) : []), [item]);
  const onBus = useCallback((b: Bus) => setBus(b), []);
  const onHover = useCallback((k: string | null) => hoverStore.set(k), []);

  // keyboard stepping
  useEffect(() => {
    if (step === null || !item) return;
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setStep((s) => Math.min((s ?? 0) + 1, item.paras.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setStep((s) => Math.max((s ?? 0) - 1, 0));
      } else if (e.key === 'Escape') setStep(null);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [step, item]);

  const e = byId.get(id);
  if (!e) return <div className="page"><p>No such item: {id}</p></div>;

  const title = modern?.meta.title;
  const enunciation = item?.paras.find((p) => p.role === 'enunciation');
  const isProp = e.kind === 'prop';
  const labelInfo = (label: string, kind: string) => {
    if (!bus) return null;
    const t = resolve(bus.scene, label, (kind || null) as Kind);
    if (!t) return null;
    return { key: t.key, colour: byrne ? bus.resolved.colours.get(t.key)?.colour : undefined };
  };

  const firstStep = item ? Math.max(0, item.paras.findIndex((p) => p.role !== 'enunciation')) : 0;
  const heath = item && (
    <HeathText
      paras={item.paras}
      bus={bus}
      byrne={byrne && !!fig}
      hoverKey={hoverKey}
      onHover={onHover}
      step={step}
      onStep={fig ? (i) => setStep(i) : undefined}
      skipEnunciation={isProp}
    />
  );
  const modernView =
    modern === undefined ? null : modern === null ? (
      <p className="muted">The modern version of this item has not been written yet.</p>
    ) : (
      <Suspense fallback={null}>
        <Markdown src={modern.body} labelInfo={labelInfo} hoverKey={hoverKey} onHover={onHover} />
      </Suspense>
    );

  const prev = prevId(id);
  const next = nextId(id);
  const cs = cites.get(id) ?? [];
  const by = (citedBy.get(id) ?? []).slice().sort((a, b) => index(a) - index(b));

  return (
    <article className={`item-page kind-${e.kind} ${fig ? 'has-figure' : ''}`}>
      <header className="item-head">
        <div className="crumbs">
          <a href={`#/book/${e.book}`}>Book {ROMAN[e.book]}</a>
          <span aria-hidden="true"> › </span>
          <span>{longLabel(id).replace(/^Book [IVX]+, /, '')}</span>
        </div>
        <h1>
          <span className="item-num">{citeLabel(id)}</span>
          {title && <span className="item-title">{title}</span>}
        </h1>
        <div className="badges">
          {isProp && <span className={`badge ${e.problem ? 'problem' : 'theorem'}`}>{e.problem ? 'Construction' : 'Theorem'}</span>}
          {isProp && (usesParallelPostulate(id) ? (
            <a className="badge p5" href="#/graph?focus=1.post.5" title="This proposition depends, directly or not, on the parallel postulate">Uses the parallel postulate</a>
          ) : e.book === 1 ? (
            <span className="badge neutral" title="Proved without the parallel postulate: true in hyperbolic geometry too">Neutral geometry</span>
          ) : null)}
          {isProp && <a className="badge" href={`#/graph?focus=${id}`} title="Longest chain of propositions below this one">Depth {depth(id)}</a>}
        </div>
        {enunciation && isProp && (
          <blockquote className="enunciation">
            {renderInlines(enunciation.c, { next: () => null })}
          </blockquote>
        )}
      </header>

      <div className="item-body">
        <div className="text-col">
          <div className="mode-tabs" role="tablist" aria-label="Text">
            {(['both', 'heath', 'modern'] as TextMode[]).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => textModeStore.set(m)}>
                {m === 'both' ? 'Both' : m === 'heath' ? 'Heath (1908)' : 'Modern'}
              </button>
            ))}
          </div>
          {(mode === 'heath' || mode === 'both') && (
            <section className="heath-section" aria-label="Heath's translation">
              {mode === 'both' && <h2 className="section-label">Euclid, in Heath’s translation</h2>}
              {item ? heath : <p className="muted">Loading…</p>}
            </section>
          )}
          {(mode === 'modern' || mode === 'both') && (
            <section className="modern-section" aria-label="Modern version">
              {mode === 'both' && <h2 className="section-label">In modern terms</h2>}
              {modernView}
            </section>
          )}

          {(cs.length > 0 || by.length > 0) && (
            <section className="deps">
              {cs.length > 0 && (
                <div>
                  <h3>Uses</h3>
                  <div className="chips">{cs.map((c) => <Cite key={c} id={c} />)}</div>
                </div>
              )}
              {by.length > 0 && (
                <div>
                  <h3>Used by</h3>
                  <div className="chips">{by.map((c) => <Cite key={c} id={c} />)}</div>
                </div>
              )}
            </section>
          )}

          {item && item.notes.length > 0 && (
            <details className="notes">
              <summary>Heath’s notes on the text ({item.notes.length})</summary>
              {item.notes.map((n, i) => (
                <div key={i} className="note">
                  {n.lemma && <div className="note-lemma">{n.lemma}</div>}
                  {n.paras.map((p, j) => <p key={j}>{renderInlines(p, { next: () => null })}</p>)}
                </div>
              ))}
            </details>
          )}

          <nav className="pager">
            {prev ? <a href={hrefOf(prev)}>← {citeLabel(prev)}</a> : <span />}
            {next ? <a href={hrefOf(next)}>{citeLabel(next)} →</a> : <span />}
          </nav>
        </div>

        {fig && (
          <aside className="figure-col">
            <div className="figure-sticky">
              <FigureView def={fig} mentions={mentions} step={step} byrne={byrne} hoverKey={hoverKey} onHover={onHover} onBus={onBus}>
                <button className={`chip-btn ${byrne ? 'on' : ''}`} onClick={() => byrneStore.set(!byrne)} title="Colour the objects as in Byrne's edition of 1847">
                  ◆ Byrne
                </button>
                {step === null ? (
                  <button className="chip-btn" onClick={() => setStep(firstStep)} title="Build the figure up paragraph by paragraph">
                    ▶ Step through
                  </button>
                ) : (
                  <span className="stepper">
                    <button className="chip-btn" onClick={() => setStep(Math.max(0, step - 1))} aria-label="Previous step">◀</button>
                    <span className="step-n">{step + 1}/{item?.paras.length ?? 0}</span>
                    <button className="chip-btn" onClick={() => setStep(Math.min((item?.paras.length ?? 1) - 1, step + 1))} aria-label="Next step">▶</button>
                    <button className="chip-btn" onClick={() => setStep(null)}>Whole figure</button>
                  </span>
                )}
              </FigureView>
            </div>
          </aside>
        )}
      </div>
    </article>
  );
}

const index = (id: string) => {
  const e = byId.get(id);
  return e ? e.book * 1000 + (e.kind === 'prop' ? 100 : 0) + e.n : 0;
};
