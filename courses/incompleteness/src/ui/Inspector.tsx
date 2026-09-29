import { useEffect } from 'react';
import { inspect, inspectorCollapsed, inspectorNarrow, inspectorPinned, inspectorStore, useStore } from './store';

/** The contextual inspector: explains whatever is hovered, focused or selected. */
export function Inspector() {
  const entry = useStore(inspectorStore);
  const pinned = useStore(inspectorPinned);
  // On narrow screens the inspector floats over the page: start collapsed, open when something is pinned.
  const collapsed = useStore(inspectorCollapsed);
  const setCollapsed = (f: (c: boolean) => boolean) => inspectorCollapsed.set(f(inspectorCollapsed.get()));
  useEffect(() => {
    if (inspectorNarrow()) inspectorCollapsed.set(true);
  }, []);
  useEffect(() => {
    if (pinned && entry && inspectorNarrow()) inspectorCollapsed.set(false);
  }, [pinned, entry]);
  return (
    <aside id="inspector" className={`inspector ${collapsed ? 'collapsed' : ''}`} aria-label="Inspector" aria-live="polite">
      <div className="inspector-head">
        <span>{entry?.kicker ?? 'Inspector'}</span>
        <span>
          {pinned && entry && (
            <button className="icon-btn" onClick={() => inspect(null, true)} title="Unpin (Esc)" aria-label="Unpin">
              📌 ✕
            </button>
          )}
          <button className="icon-btn inspector-toggle" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </span>
      </div>
      {entry ? (
        <div className="inspector-body" key={entry.key}>
          <h4>{entry.title}</h4>
          {entry.body}
        </div>
      ) : (
        <div className="inspector-empty">
          Hover, focus or tap anything underlined with dots — a symbol, a code, a proof step, the label of a theorem — to see what it is and where it comes from. Click to pin.
        </div>
      )}
    </aside>
  );
}
