// Step-by-step controls. Steps are discrete and reversible; autoplay respects reduced motion.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { reducedMotion } from './store';

export interface StepperProps {
  step: number;
  count: number;
  onStep: (i: number) => void;
  label?: ReactNode;
  /** describe step i for screen readers and the caption */
  describe?: (i: number) => ReactNode;
}

export function Stepper({ step, count, onStep, label, describe }: StepperProps) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const go = (i: number) => onStep(Math.max(0, Math.min(count - 1, i)));
  useEffect(() => {
    if (!playing) return;
    if (step >= count - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => go(step + 1), reducedMotion() ? 1400 : 700);
    return () => clearTimeout(t);
  });
  return (
    <div
      className="stepper"
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label={typeof label === 'string' ? label : 'Step controls'}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(step + 1);
        else if (e.key === 'ArrowLeft') go(step - 1);
        else if (e.key === 'Home') go(0);
        else if (e.key === 'End') go(count - 1);
        else return;
        e.preventDefault();
      }}
    >
      <div className="stepper-buttons">
        <button onClick={() => go(0)} disabled={step === 0} aria-label="First step" title="First (Home)">⏮</button>
        <button onClick={() => go(step - 1)} disabled={step === 0} aria-label="Previous step" title="Previous (←)">◀</button>
        <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'} title="Play / pause" disabled={count <= 1}>
          {playing ? '❚❚' : '▶︎'}
        </button>
        <button onClick={() => go(step + 1)} disabled={step >= count - 1} aria-label="Next step" title="Next (→)">▶</button>
        <button onClick={() => go(count - 1)} disabled={step >= count - 1} aria-label="Last step" title="Last (End)">⏭</button>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(0, count - 1)}
        value={step}
        onChange={(e) => go(Number(e.target.value))}
        aria-label="Step"
        aria-valuetext={`step ${step + 1} of ${count}`}
      />
      <span className="stepper-count">
        {label ? <>{label} · </> : null}
        {step + 1} / {count}
      </span>
      {describe && (
        <div className="stepper-caption" aria-live="polite">
          {describe(step)}
        </div>
      )}
    </div>
  );
}
