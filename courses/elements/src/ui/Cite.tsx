// A citation chip: links to the cited item and previews its statement on hover or focus.

import { useState } from 'react';
import { byId, citeLabel, hrefOf, longLabel } from '../text';
import { modernTitle } from '../content/modern';

export function Cite({ id, text }: { id: string; text?: string }) {
  const [open, setOpen] = useState(false);
  const e = byId.get(id);
  if (!e) return <span className="cite missing">{text ?? id}</span>;
  const title = modernTitle(id);
  return (
    <span className="cite-wrap" onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)}>
      <a className={`cite k-${e.kind}`} href={hrefOf(id)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
        {text ?? citeLabel(id)}
      </a>
      {open && (
        <span className="cite-pop" role="tooltip">
          <span className="cite-pop-head">
            {longLabel(id)}
            {title && <span className="cite-pop-title"> · {title}</span>}
          </span>
          <span className="cite-pop-text">{e.text}</span>
        </span>
      )}
    </span>
  );
}
