// One item of the Elements: a proposition (with its figure), a definition, a postulate or a common notion.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FigureView, type Bus } from '../geometry/FigureView';
import type { FigureDef } from '../geometry/figure';
import { paragraphMentions } from '../geometry/reveal';
import { resolve, type Kind } from '../geometry/resolve';
import { byId, citeLabel, hrefOf, loadItem, longLabel, nextId, prevId, ROMAN } from '../text';
import type { Item } from '../text/types';
import { hasFigure, loadFigure } from '../content/figures';
import { loadModern, modernTitle, splitFrontMatter } from '../content/modern';
import { stepNote } from '../content/stepNotes';
import { HeathText, renderInlines } from '../ui/HeathText';
import { Markdown } from '../ui/Markdown';
import { Cite } from '../ui/Cite';
import { Switch } from '../ui/Switch';
import { byrneStore, hoverStore, textModeStore, useStore, type TextMode } from '../ui/store';
import { citedBy, cites, depth, usesParallelPostulate } from '../graph/deps';
import { markRead } from '../ui/progress';

const STEP_MS = 1500;

/** "Postulate 3", "Definition 15", "I.2": the name of a dependency, in full. */
function fullName(id: string, fromBook: number): string {
  const e = byId.get(id);
  if (!e) return id;
  switch (e.kind) {
    case 'prop':
      return citeLabel(id);
    case 'post':
      return `Postulate ${e.n}`;
    case 'cn':
      return `Common notion ${e.n}`;
    case 'def':
      return `${e.book === fromBook ? '' : ROMAN[e.book] + ' '}Definition ${e.group ? ROMAN[e.group] + '.' : ''}${e.n}`;
  }
}

export function ItemPage({ id }: { id: string }) {
  const [item, setItem] = useState<Item | null>(null);
  const [fig, setFig] = useState<FigureDef | null | undefined>(undefined);
  const [modern, setModern] = useState<{ meta: Record<string, string>; body: string } | null | undefined>(undefined);
  const [bus, setBus] = useState<Bus | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const textMode = useStore(textModeStore);
  const byrne = useStore(byrneStore);
  const hoverKey = useStore(hoverStore);

  useEffect(() => {
    let live = true;
    setItem(null);
    setFig(undefined);
    setModern(undefined);
    setBus(null);
    setStep(null);
    setPlaying(false);
    void loadItem(id).then((it) => live && setItem(it ?? null));
    void loadFigure(id).then((f) => live && setFig(f ?? null));
    void loadModern(id).then((m) => live && setModern(m ? splitFrontMatter(m) : null));
    window.scrollTo(0, 0);
    markRead(id);
    return () => {
      live = false;
    };
  }, [id]);

  const e = byId.get(id);
  const isProp = e?.kind === 'prop';
  const mentions = useMemo(() => (item ? paragraphMentions(item.paras) : []), [item]);
  const onBus = useCallback((b: Bus) => setBus(b), []);
  const onHover = useCallback((k: string | null) => hoverStore.set(k), []);

  // The paragraphs the reader can step through (the enunciation is shown above the text, not stepped).
  const steps = useMemo(() => (item ? item.paras.map((p, i) => i).filter((i) => !(isProp && item.paras[i].role === 'enunciation')) : []), [item, isProp]);
  const first = steps[0] ?? 0;
  const last = steps[steps.length - 1] ?? 0;
  const goto = useCallback((i: number | null) => {
    setPlaying(false);
    setStep(i);
  }, []);
  const move = useCallback(
    (d: 1 | -1) => {
      setPlaying(false);
      setStep((s) => {
        if (s === null) return d > 0 ? first : null;
        const k = steps.indexOf(s) + d;
        return steps[Math.max(0, Math.min(steps.length - 1, k))] ?? s;
      });
    },
    [steps, first],
  );

  // play: one paragraph every 1.5 s, stopping at the last
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      const k = stepRef.current === null ? -1 : steps.indexOf(stepRef.current);
      const n = steps[Math.min(steps.length - 1, k + 1)];
      setStep(n);
      if (k + 1 >= steps.length - 1) setPlaying(false);
    }, STEP_MS);
    return () => clearInterval(t);
  }, [playing, steps]);
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (!steps.length) return;
    setStep((s) => (s === null || s >= last ? first : s));
    setPlaying(true);
  };

  // keyboard: ← → step, Esc returns to the whole figure
  useEffect(() => {
    if (!fig || !item) return;
    const on = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || (ev.target as HTMLElement).closest('input, textarea, select, [role="dialog"]')) return;
      if (ev.key === 'ArrowRight' || (step !== null && ev.key === 'ArrowDown')) {
        ev.preventDefault();
        move(1);
      } else if (ev.key === 'ArrowLeft' || (step !== null && ev.key === 'ArrowUp')) {
        ev.preventDefault();
        move(-1);
      } else if (ev.key === 'Escape') goto(null);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [fig, item, step, move, goto]);

  if (!e) return <div className="page"><p>No such item: {id}</p></div>;

  const title = modern?.meta.title ?? modernTitle(id);
  const enunciation = item?.paras.find((p) => p.role === 'enunciation');
  const labelInfo = (label: string, kind: string) => {
    if (!bus) return null;
    const t = resolve(bus.scene, label, (kind || null) as Kind);
    if (!t) return null;
    return { key: t.key, colour: byrne ? bus.resolved.colours.get(t.key)?.colour : undefined };
  };

  // With nothing of Heath's to show (some definitions are not in his text) the modern version is the page.
  const mode: TextMode = item && item.paras.length === 0 ? 'modern' : textMode;
  const wantsFigure = hasFigure(id);

  const heath = item && (
    <HeathText
      paras={item.paras}
      bus={bus}
      byrne={byrne && !!fig}
      hoverKey={hoverKey}
      onHover={onHover}
      step={step}
      onStep={fig ? (i) => goto(i) : undefined}
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
  const by = (citedBy.get(id) ?? []).slice().sort((a, b) => order(a) - order(b));
  const nextTitle = next ? modernTitle(next) ?? shorten(byId.get(next)?.text ?? '') : '';

  const pos = step === null ? -1 : steps.indexOf(step);
  const stepper = item && steps.length > 0 && (
    <div className="fig-row1">
      <button className="play-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Step through the proof'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="step-main">
        <div className="step-track" role="group" aria-label="Steps">
          {steps.map((i, k) => (
            <button key={i} className={k === pos ? 'cur' : k < pos ? 'done' : ''} onClick={() => goto(i)} title={stepNote(item, i)} aria-label={`Step ${k + 1}: ${stepNote(item, i)}`} aria-current={k === pos ? 'step' : undefined} />
          ))}
        </div>
        <div className="step-note" aria-live="polite">
          {step === null ? 'The whole figure. Press play to build it paragraph by paragraph.' : `${pos + 1} / ${steps.length} · ${stepNote(item, step)}`}
        </div>
      </div>
    </div>
  );

  return (
    <article className={`item-page kind-${e.kind} ${wantsFigure ? 'has-figure' : 'no-figure'}`}>
      {wantsFigure && (
        <aside className="figure-col" aria-label="Figure">
          {fig ? (
            <FigureView def={fig} mentions={mentions} step={step} byrne={byrne} hoverKey={hoverKey} onHover={onHover} onBus={onBus} stepper={stepper} hint="← → to step.">
              <button className={`toggle ${byrne ? 'on' : ''}`} onClick={() => byrneStore.set(!byrne)} role="switch" aria-checked={byrne} title="Colour the objects as in Byrne's edition of 1847">
                <span className="track" />
                Byrne colours
              </button>
            </FigureView>
          ) : (
            <div className="figure" style={{ aspectRatio: '600 / 433' }} />
          )}
        </aside>
      )}

      <div className="text-col">
        <header className="item-head">
          <p className="kicker item-kicker">
            Book {ROMAN[e.book]} · {longLabel(id).replace(/^Book [IVX]+, /, '')}
          </p>
          <h1>{title ?? citeLabel(id)}</h1>
          <div className="badges">
            {isProp && (
              <span className="pill">
                <span className={`sh diamond ${e.problem ? 'blue' : 'red'}`} />
                {e.problem ? 'Construction' : 'Theorem'}
              </span>
            )}
            {isProp &&
              (usesParallelPostulate(id) ? (
                <a className="pill" href="#/graph?focus=1.post.5" title="This proposition depends, directly or not, on the parallel postulate">
                  <span className="sh tri" style={{ ['--c' as string]: 'var(--amber)' }} />
                  Uses the parallel postulate
                </a>
              ) : e.book === 1 ? (
                <span className="pill" title="Proved without the parallel postulate: true in hyperbolic geometry too">
                  <span className="sh dot green" />
                  Neutral geometry
                </span>
              ) : null)}
            {e.bracketed && (
              <span className="pill dashed" title="Heath prints this proposition in square brackets: Heiberg judged it a later interpolation">
                Bracketed: possibly not Euclid’s
              </span>
            )}
            {isProp && (
              <a className="pill plain" href={`#/graph?focus=${id}`} title="Longest chain of propositions below this one">
                Depth {depth(id)}
              </a>
            )}
          </div>
          {enunciation && isProp && <blockquote className="enunciation">{renderInlines(enunciation.c, { next: () => null })}</blockquote>}
        </header>

        {(item?.paras.length ?? 1) > 0 && (
          <Switch<TextMode>
            label="Text"
            value={mode}
            onChange={(m) => textModeStore.set(m)}
            options={[
              { value: 'heath', label: 'Euclid · Heath, 1908' },
              { value: 'modern', label: 'In modern terms' },
            ]}
          />
        )}
        {mode === 'heath' ? (
          <section className="heath-section" aria-label="Heath's translation">
            {item ? <>{heath}</> : <p className="muted">Loading…</p>}
          </section>
        ) : (
          <section className="modern-section" aria-label="Modern version">
            {item && item.paras.length === 0 && <p className="muted">This definition is not in Heath’s text; here is the modern version.</p>}
            {modernView}
          </section>
        )}

        {(cs.length > 0 || by.length > 0) && (
          <section className="deps">
            {cs.length > 0 && (
              <div>
                <h3>Rests on</h3>
                <div className="chips">{cs.map((c) => <Cite key={c} id={c} text={fullName(c, e.book)} chip />)}</div>
              </div>
            )}
            {by.length > 0 && (
              <div>
                <h3>Used by</h3>
                <div className="chips">{by.map((c) => <Cite key={c} id={c} text={fullName(c, e.book)} chip />)}</div>
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

        {next && (
          <a className="next-card" href={hrefOf(next)}>
            <span className="lbl-next">Next</span>
            <span className="next-title">
              {citeLabel(next)}
              {nextTitle && ` · ${nextTitle}`}
            </span>
            <span className="arrow" aria-hidden="true">→</span>
          </a>
        )}
        {prev && (
          <a className="prev-link" href={hrefOf(prev)}>
            ← Previous: {citeLabel(prev)}
          </a>
        )}
      </div>
    </article>
  );
}

const shorten = (s: string) => (s.length > 60 ? s.slice(0, s.lastIndexOf(' ', 60)) + '…' : s);

const order = (id: string) => {
  const e = byId.get(id);
  return e ? e.book * 1000 + (e.kind === 'prop' ? 100 : 0) + e.n : 0;
};
