// Exercises added for this edition. Answers are checked by the engine where that is possible;
// progress is kept in the browser.

import { useState, type ReactNode } from 'react';
import { persist, persisted } from './store';
import { Prov } from './Prov';

export type Checker = (answer: string) => { ok: boolean; message?: ReactNode };

export interface ExerciseProps {
  id: string;
  title?: ReactNode;
  children: ReactNode;
  /** a free-text answer checked by a function */
  check?: Checker;
  /** multiple choice */
  choices?: { label: ReactNode; correct?: boolean; why: ReactNode }[];
  placeholder?: string;
  /** Only a Check button (the answer is read from a workbench). */
  noInput?: boolean;
  hint?: ReactNode;
  solution?: ReactNode;
}

export function Exercise({ id, title, children, check, choices, placeholder, noInput, hint, solution }: ExerciseProps) {
  const key = `ic.ex.${id}`;
  const [done, setDone] = useState<boolean>(() => persisted(key, false));
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; message?: ReactNode } | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const succeed = () => {
    setDone(true);
    persist(key, true);
  };
  return (
    <section className={`exercise ${done ? 'done' : ''}`} aria-label="Exercise">
      <header className="ex-head">
        <span className="ex-kicker">Exercise</span>
        {title && <span className="ex-title">{title}</span>}
        <Prov kind="added" />
        {done && <span className="ex-done">✓ solved</span>}
      </header>
      <div className="ex-body">{children}</div>
      {check && (
        <form
          className="ex-form"
          onSubmit={(e) => {
            e.preventDefault();
            const r = check(answer);
            setFeedback(r);
            if (r.ok) succeed();
          }}
        >
          {!noInput && <input className="fi-field" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={placeholder ?? 'Your answer'} aria-label="Your answer" spellCheck={false} />}
          <button className="chip-btn primary" type="submit">
            Check
          </button>
        </form>
      )}
      {choices && (
        <div className="ex-choices" role="radiogroup">
          {choices.map((c, i) => (
            <button
              key={i}
              role="radio"
              aria-checked={picked === i}
              className={`ex-choice ${picked === i ? (c.correct ? 'right' : 'wrong') : ''}`}
              onClick={() => {
                setPicked(i);
                setFeedback({ ok: !!c.correct, message: c.why });
                if (c.correct) succeed();
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {feedback && (
        <div className={`ex-feedback ${feedback.ok ? 'ok' : 'no'}`} role="status">
          <b>{feedback.ok ? 'Right.' : 'Not quite.'}</b> {feedback.message}
        </div>
      )}
      <div className="ex-help">
        {hint && (
          <button className="linklike" onClick={() => setShowHint((s) => !s)} aria-expanded={showHint}>
            {showHint ? 'hide hint' : 'hint'}
          </button>
        )}
        {solution && (
          <button className="linklike" onClick={() => setShowSolution((s) => !s)} aria-expanded={showSolution}>
            {showSolution ? 'hide solution' : 'solution'}
          </button>
        )}
      </div>
      {showHint && <div className="ex-hint">{hint}</div>}
      {showSolution && <div className="ex-solution">{solution}</div>}
    </section>
  );
}
