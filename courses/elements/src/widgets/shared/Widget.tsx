// The frame shared by widgets.
import type { ReactNode } from 'react';

export function Widget({ title, children, note }: { title?: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="widget">
      {title && <div className="widget-title">{title}</div>}
      {children}
      {note && <p className="note">{note}</p>}
    </div>
  );
}
