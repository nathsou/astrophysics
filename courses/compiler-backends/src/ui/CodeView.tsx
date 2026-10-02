import { memo, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import type { Line } from '../compiler/listing';
import { hideTip, hintStore, setHighlight, showTip, Store, useStore } from './store';

export interface CodeViewProps {
  lines: Line[];
  target?: string;
  gutter?: 'num' | 'addr' | 'none';
  bytes?: boolean;
  maxHeight?: number | string;
  minHeight?: number | string;
  onLineClick?: (index: number, line: Line) => void;
  mark?: (line: Line, index: number) => string | undefined;
  notes?: boolean;
  /** send the hovered line's note to the page's shared hint line (hintStore) instead of a bar under the listing */
  hints?: boolean;
  className?: string;
  scrollTo?: number;
  style?: CSSProperties;
  empty?: ReactNode;
}

const TAG_LABEL: Record<string, string> = {
  spill: 'spill', reload: 'reload', remat: 'remat', prologue: 'prologue', epilogue: 'epilogue', copy: 'copy',
  'phi-copy': 'phi copy', 'phi-const': 'phi const', abi: 'abi', split: 'edge split',
};

const LineRow = memo(function LineRow({ l, i, gutter, bytes, mark }: { l: Line; i: number; gutter: string; bytes?: boolean; mark?: string }) {
  const cls = `ln k-${l.kind ?? 'instr'}${mark ? ` m-${mark}` : l.mark ? ` m-${l.mark}` : ''}`;
  return (
    <div className={cls} data-k={l.key} data-l={l.links?.length ? l.links.join(' ') : undefined} data-i={i} style={l.color ? { borderLeftColor: l.color, borderLeftWidth: 4 } : undefined}>
      {gutter === 'num' && <span className="gut">{i + 1}</span>}
      {gutter === 'addr' && <span className="addr">{l.addr !== undefined ? l.addr.toString(16).padStart(5, '0') : ''}</span>}
      {bytes && <span className="bytes">{l.bytes ?? ''}</span>}
      <span className="txt">
        {l.indent ? ' '.repeat(l.indent) : ''}
        {l.toks.map((t, k) => (
          <span key={k} className={t.c ? `t-${t.c}` : undefined} data-k={t.key} data-ti={t.info ? k : undefined}>
            {t.t}
          </span>
        ))}
      </span>
      {l.tag && TAG_LABEL[l.tag] && <span className={`tag tag-${l.tag}`}>{TAG_LABEL[l.tag]}</span>}
    </div>
  );
});

function NoteBar({ store, lines }: { store: Store<number | null>; lines: Line[] }) {
  const i = useStore(store);
  const l = i !== null ? lines[i] : undefined;
  return (
    <div className="code-note" aria-live="polite">
      {l?.note ? (
        <>
          <span className="why">why</span>
          <span>{l.note}</span>
        </>
      ) : (
        <span className="muted">Focus or tap this listing. Use ↑/↓ for instructions and ←/→ for operand details. Escape clears the explanation.</span>
      )}
    </div>
  );
}

export function CodeView({ lines, target, gutter = 'none', bytes, maxHeight, minHeight, onLineClick, mark, notes, hints, className, scrollTo, style, empty }: CodeViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hovered = useMemo(() => new Store<number | null>(null), []);
  const lastKey = useRef<string>('');
  const selected = useRef(0);
  const operand = useRef(-1);

  useEffect(() => {
    if (scrollTo === undefined || !ref.current) return;
    const el = ref.current.querySelector(`[data-i="${scrollTo}"]`) as HTMLElement | null;
    if (!el) return;
    const box = ref.current;
    const top = el.offsetTop - box.clientHeight / 3;
    if (el.offsetTop < box.scrollTop || el.offsetTop > box.scrollTop + box.clientHeight - 30) box.scrollTo({ top, behavior: 'smooth' });
  }, [scrollTo]);

  const inspect = (t: HTMLElement) => {
    const lnEl = t.closest('.ln') as HTMLElement | null;
    if (!lnEl) return;
    const i = Number(lnEl.dataset.i);
    const line = lines[i];
    if (!line) return;
    selected.current = i;
    hovered.set(i);
    if (hints) hintStore.set(line.note ? { why: 'why', text: line.note } : null);
    const tokEl = t.closest('[data-ti]') as HTMLElement | null;
    if (tokEl) {
      const tk = line.toks[Number(tokEl.dataset.ti)];
      const key = `t:${i}:${tokEl.dataset.ti}`;
      if (lastKey.current === key) return;
      lastKey.current = key;
      if (tk?.info) showTip(tokEl, { info: tk.info, ctx: { target } });
      if (tk?.key) setHighlight({ own: [tk.key] });
      else setHighlight({ own: line.key ? [line.key] : [], linkedTo: line.key ? [line.key] : [] });
      return;
    }
    const key = `l:${i}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    hideTip();
    const own = [...(line.key ? [line.key] : []), ...(line.links ?? [])];
    setHighlight({ own, linkedTo: line.key ? [line.key] : [] });
  };
  const onLeave = () => {
    lastKey.current = '';
    hovered.set(null);
    if (hints) hintStore.set(null);
    hideTip();
    setHighlight(null);
  };
  const onClick = (e: React.MouseEvent) => {
    ref.current?.focus();
    inspect(e.target as HTMLElement);
    if (!onLineClick) return;
    const lnEl = (e.target as HTMLElement).closest('.ln') as HTMLElement | null;
    if (lnEl) onLineClick(Number(lnEl.dataset.i), lines[Number(lnEl.dataset.i)]);
  };

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, ...style }}>
      <div
        ref={ref}
        className={`code${className?.includes('gnode') ? '' : ' inv'}`}
        style={{ maxHeight, minHeight, flex: 1, cursor: onLineClick ? 'pointer' : undefined, padding: '8px 0' }}
        tabIndex={0}
        role="group"
        aria-label="Instruction listing. Up and down select instructions; left and right inspect operands; Enter selects a line."
        onFocus={() => { const el = ref.current?.querySelector<HTMLElement>(`[data-i="${selected.current}"]`); if (el) inspect(el); }}
        onBlur={onLeave}
        onMouseOver={e => inspect(e.target as HTMLElement)}
        onMouseLeave={() => { if (document.activeElement !== ref.current) onLeave(); }}
        onKeyDown={e => {
          if (e.key === 'Escape') { onLeave(); return; }
          if (e.key === 'Enter') { const line = lines[selected.current]; if (line) onLineClick?.(selected.current, line); return; }
          if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
          e.preventDefault();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { selected.current = Math.max(0, Math.min(lines.length - 1, selected.current + (e.key === 'ArrowDown' ? 1 : -1))); operand.current = -1; }
          if (e.key === 'Home') { selected.current = 0; operand.current = -1; }
          if (e.key === 'End') { selected.current = lines.length - 1; operand.current = -1; }
          const line = ref.current?.querySelector<HTMLElement>(`[data-i="${selected.current}"]`);
          if (!line) return;
          const tokens = [...line.querySelectorAll<HTMLElement>('[data-ti]')];
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') operand.current = Math.max(-1, Math.min(tokens.length - 1, operand.current + (e.key === 'ArrowRight' ? 1 : -1)));
          inspect(tokens[operand.current] ?? line);
          line.scrollIntoView({ block: 'nearest' });
        }}
        onClick={onClick}
      >
        {lines.length === 0 && empty}
        {lines.map((l, i) => (
          <LineRow key={i} l={l} i={i} gutter={gutter} bytes={bytes} mark={mark?.(l, i)} />
        ))}
      </div>
      {notes && !hints && <NoteBar store={hovered} lines={lines} />}
    </div>
  );
}
