import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Segmented control: a radio group of buttons. Tab reaches the selected option;
 * arrow keys (and Home/End) move the selection, as with native radio buttons.
 */
export function Seg<T extends string | number>({ value, options, onChange, title, label, disabled }: { value: T; options: (T | [T, string])[]; onChange: (v: T) => void; title?: string; label?: string; disabled?: boolean }) {
  const opts = options.map((o): [T, string] => (Array.isArray(o) ? o : [o, String(o)]));
  const cur = Math.max(0, opts.findIndex(([v]) => v === value));
  const onKey = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    const k = d ? (cur + d + opts.length) % opts.length : e.key === 'Home' ? 0 : e.key === 'End' ? opts.length - 1 : -1;
    if (k < 0 || disabled) return;
    e.preventDefault();
    onChange(opts[k][0]);
    const btns = e.currentTarget.querySelectorAll('button');
    (btns[k] as HTMLButtonElement | undefined)?.focus();
  };
  return (
    <span className="seg ctl" title={title} role="radiogroup" aria-label={label ?? title} aria-disabled={disabled || undefined} onKeyDown={onKey}>
      {opts.map(([v, lbl], k) => (
        <button key={String(v)} type="button" role="radio" className={v === value ? 'on' : ''} onClick={() => onChange(v)} aria-checked={v === value} tabIndex={k === cur ? 0 : -1} disabled={disabled}>
          {lbl}
        </button>
      ))}
    </span>
  );
}

export function Check({ checked, onChange, children, title, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; title?: string; disabled?: boolean }) {
  return (
    <label className="check" title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      {children}
    </label>
  );
}

export function Select<T extends string>({ value, options, onChange, label, id }: { value: T; options: [T, string][]; onChange: (v: T) => void; label?: string; id?: string }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label} id={id}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

// ------------------------------------------------------------ popover

/**
 * A button that discloses a non-modal panel (options, a download menu). The
 * panel closes on Escape (focus returns to the button) and on a click outside.
 */
export function Popover({ label, badge, children, id, align = 'right', title, className = '' }: { label: ReactNode; badge?: ReactNode; children: ReactNode | ((close: () => void) => ReactNode); id: string; align?: 'left' | 'right'; title?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <span className={`pop ${className}`} ref={wrap}>
      <button ref={btn} type="button" className={`pop-btn ${open ? 'open' : ''}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} title={title}>
        {label}
        {badge !== undefined && badge !== null && badge !== 0 && <span className="pop-badge">{badge}</span>}
        <span className="caret" aria-hidden="true">▾</span>
      </button>
      <div id={id} className={`pop-panel ${align}`} hidden={!open}>
        {open && (typeof children === 'function' ? children(close) : children)}
      </div>
    </span>
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
