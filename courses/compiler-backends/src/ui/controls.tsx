import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export function Seg<T extends string | number>({ value, options, onChange, title }: { value: T; options: (T | [T, string])[]; onChange: (v: T) => void; title?: string }) {
  return (
    <span className="seg ctl" title={title} role="group">
      {options.map((o) => {
        const [v, label]: [T, string] = Array.isArray(o) ? o : [o, String(o)];
        return (
          <button key={String(v)} className={v === value ? 'on' : ''} onClick={() => onChange(v)} aria-pressed={v === value}>
            {label}
          </button>
        );
      })}
    </span>
  );
}

export function Check({ checked, onChange, children, title }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; title?: string }) {
  return (
    <label className="check" title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

export function Select<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

// ------------------------------------------------------------ stepping

export interface StepperState {
  i: number;
  n: number;
  set: (i: number) => void;
  next: () => void;
  prev: () => void;
  playing: boolean;
  toggle: () => void;
}

export function useStepper(n: number, opts: { initial?: number; interval?: number } = {}): StepperState {
  const [i, setI] = useState(opts.initial ?? 0);
  const [playing, setPlaying] = useState(false);
  const nRef = useRef(n);
  nRef.current = n;
  useEffect(() => { if (i > n - 1) setI(Math.max(0, n - 1)); }, [n, i]);
  useEffect(() => {
    if (!playing) return;
    const h = setInterval(() => {
      setI((x) => {
        if (x >= nRef.current - 1) { setPlaying(false); return x; }
        return x + 1;
      });
    }, opts.interval ?? 700);
    return () => clearInterval(h);
  }, [playing, opts.interval]);
  const set = useCallback((x: number) => setI(Math.max(0, Math.min(nRef.current - 1, x))), []);
  return {
    i: Math.min(i, Math.max(0, n - 1)), n, set,
    next: () => set(i + 1), prev: () => set(i - 1),
    playing,
    toggle: () => {
      if (!playing && i >= n - 1) setI(0);
      setPlaying((p) => !p);
    },
  };
}

const Icon = ({ d }: { d: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d={d} />
  </svg>
);
const ICONS = {
  first: 'M3 3h2v10H3zM13 3v10L6 8z',
  prev: 'M11 3v10L4 8z',
  next: 'M5 3v10l7-5z',
  last: 'M11 3h2v10h-2zM3 3v10l7-5z',
  play: 'M4 2.5v11l9.5-5.5z',
  pause: 'M4 3h3v10H4zM9 3h3v10H9z',
};

export function Stepper({ s, label, children }: { s: StepperState; label?: ReactNode; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.closest('.figure-body') as HTMLElement | null;
    if (!el) return;
    el.tabIndex = el.tabIndex >= 0 ? el.tabIndex : 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,.cm-editor,select')) return;
      if (e.key === 'ArrowRight') { s.next(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { s.prev(); e.preventDefault(); }
      else if (e.key === ' ') { s.toggle(); e.preventDefault(); }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [s]);
  return (
    <div className="stepper" ref={ref}>
      <span className="btns">
        <button className="icon-btn" onClick={() => s.set(0)} disabled={s.i === 0} title="First step"><Icon d={ICONS.first} /></button>
        <button className="icon-btn" onClick={s.prev} disabled={s.i === 0} title="Previous step (←)"><Icon d={ICONS.prev} /></button>
        <button className="icon-btn play" onClick={s.toggle} title="Play / pause (space)"><Icon d={s.playing ? ICONS.pause : ICONS.play} /></button>
        <button className="icon-btn" onClick={s.next} disabled={s.i >= s.n - 1} title="Next step (→)"><Icon d={ICONS.next} /></button>
        <button className="icon-btn" onClick={() => s.set(s.n - 1)} disabled={s.i >= s.n - 1} title="Last step"><Icon d={ICONS.last} /></button>
      </span>
      <input type="range" className="range" min={0} max={Math.max(0, s.n - 1)} value={s.i} onChange={(e) => s.set(Number(e.target.value))} aria-label="step" />
      <span className="count">{s.n ? `${s.i + 1} / ${s.n}` : '—'}</span>
      {label}
      {children}
    </div>
  );
}
