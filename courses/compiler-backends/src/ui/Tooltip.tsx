import { useLayoutEffect, useRef, useState } from 'react';
import { explain } from './explain';
import { tipStore, useStore } from './store';

export function Tooltip() {
  const tip = useStore(tipStore);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!tip || !ref.current) { setPos(null); return; }
    const r = ref.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = Math.min(Math.max(8, tip.x), vw - r.width - 8);
    let top = tip.y2 + 8;
    if (top + r.height > vh - 8) top = Math.max(8, tip.y - r.height - 8);
    setPos({ left, top });
    void left;
  }, [tip]);
  if (!tip) return null;
  return (
    <div ref={ref} className="tip" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }} role="tooltip">
      {tip.node ?? (tip.info ? explain(tip.info, tip.why, tip.ctx?.target) : null)}
    </div>
  );
}
