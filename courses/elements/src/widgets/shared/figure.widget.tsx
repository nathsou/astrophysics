// ::figure{of="1.47"} shows the figure of another proposition inline (without text linking).
import { useEffect, useState } from 'react';
import { FigureView } from '../../geometry/FigureView';
import type { FigureDef } from '../../geometry/figure';
import { loadFigure } from '../../content/figures';
import { citeLabel } from '../../text';

export default function FigureOf({ of }: Record<string, string>) {
  const [def, setDef] = useState<FigureDef | null>(null);
  useEffect(() => {
    void loadFigure(of).then((d) => setDef(d ?? null));
  }, [of]);
  if (!def) return null;
  return (
    <div className="widget">
      <div className="widget-title">
        The figure of <a href={`#/${of}`}>{citeLabel(of)}</a>
      </div>
      <FigureView def={def} />
    </div>
  );
}
