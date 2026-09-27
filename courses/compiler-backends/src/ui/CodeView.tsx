import { memo, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import type { Line } from '../compiler/listing';
import { hideTip, setHighlight, showTip, Store, useStore } from './store';

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
    <div className="code-note">
      {l?.note ? (
        <>
          <span className="why">why</span>
          <span>{l.note}</span>
        </>
      ) : (
        <span className="muted">Hover an instruction to see why it is there; hover operands for details.</span>
      )}
    </div>
  );
}

export function CodeView({ lines, target, gutter = 'none', bytes, maxHeight, minHeight, onLineClick, mark, notes, className, scrollTo, style, empty }: CodeViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hovered = useMemo(() => new Store<number | null>(null), []);
  const lastKey = useRef<string>('');

  useEffect(() => {
    if (scrollTo === undefined || !ref.current) return;
    const el = ref.current.querySelector(`[data-i="${scrollTo}"]`) as HTMLElement | null;
    if (!el) return;
    const box = ref.current;
    const top = el.offsetTop - box.clientHeight / 3;
    if (el.offsetTop < box.scrollTop || el.offsetTop > box.scrollTop + box.clientHeight - 30) box.scrollTo({ top, behavior: 'smooth' });
  }, [scrollTo]);

  const onOver = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const lnEl = t.closest('.ln') as HTMLElement | null;
    if (!lnEl) return;
    const i = Number(lnEl.dataset.i);
    const line = lines[i];
    if (!line) return;
    hovered.set(i);
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
    hideTip();
    setHighlight(null);
  };
  const onClick = (e: React.MouseEvent) => {
    if (!onLineClick) return;
    const lnEl = (e.target as HTMLElement).closest('.ln') as HTMLElement | null;
    if (lnEl) onLineClick(Number(lnEl.dataset.i), lines[Number(lnEl.dataset.i)]);
  };

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, ...style }}>
      <div
        ref={ref}
        className="code"
        style={{ maxHeight, minHeight, flex: 1, cursor: onLineClick ? 'pointer' : undefined, padding: '8px 0' }}
        onMouseOver={onOver}
        onMouseLeave={onLeave}
        onClick={onClick}
      >
        {lines.length === 0 && empty}
        {lines.map((l, i) => (
          <LineRow key={i} l={l} i={i} gutter={gutter} bytes={bytes} mark={mark?.(l, i)} />
        ))}
      </div>
      {notes && <NoteBar store={hovered} lines={lines} />}
    </div>
  );
}
