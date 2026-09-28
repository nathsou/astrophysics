// The book's index: the terms its definitions introduce, alphabetically, each linked to the
// definition(s) where it is introduced. Generated from search.json (see scripts/convert.ts).

import { useEffect, useMemo, useState } from 'react';
import type { SearchEntry } from '../content/schema';
import { sourceIndex } from '../content/source';
import { Attribution } from './Attribution';

const GREEK: Record<string, string> = { α: 'alpha', β: 'beta', λ: 'lambda', μ: 'mu', ω: 'omega', Σ: 'sigma', Δ: 'delta', Π: 'pi' };
const sortKey = (t: string) =>
  t
    .replace(/^[αβλμωΣΔΠ]/, (g) => GREEK[g] ?? g)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function IndexPage() {
  document.title = 'Index — Incompleteness and Computability';
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  useEffect(() => {
    import('../content/source/search.json').then((m) => setEntries(m.default as SearchEntry[]));
  }, []);
  const sectionNumber = useMemo(() => new Map(sourceIndex.chapters.flatMap((c) => c.sections.map((s) => [s.id, s.number] as const))), []);
  const groups = useMemo(() => {
    const byTerm = new Map<string, SearchEntry[]>();
    for (const e of entries ?? []) {
      if (e.kind !== 'term') continue;
      const list = byTerm.get(e.head) ?? [];
      if (!list.some((x) => x.anchor === e.anchor)) list.push(e);
      byTerm.set(e.head, list);
    }
    const terms = [...byTerm].sort(([a], [b]) => sortKey(a).localeCompare(sortKey(b)));
    const out = new Map<string, [string, SearchEntry[]][]>();
    for (const t of terms) {
      const letter = sortKey(t[0])[0].toUpperCase();
      out.set(letter, [...(out.get(letter) ?? []), t]);
    }
    return [...out];
  }, [entries]);

  return (
    <div className="page no-inspector">
      <div className="column about">
        <p className="kicker">Index</p>
        <h1>Terms defined in the book</h1>
        <p className="muted sans small">
          Terms introduced in the book’s definitions, with the definition that introduces each (Formal mode). Use search (<kbd>/</kbd>) for theorems and sections.
        </p>
        {entries === null ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <nav className="index-letters" aria-label="Letters">
              {groups.map(([l]) => (
                <a
                  key={l}
                  href="#/index"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`index-${l}`)?.scrollIntoView();
                  }}
                >
                  {l}
                </a>
              ))}
            </nav>
            {groups.map(([letter, terms]) => (
              <section key={letter} className="index-group" id={`index-${letter}`}>
                <h2>{letter}</h2>
                <ul>
                  {terms.map(([term, list]) => (
                    <li key={term}>
                      <span className="index-term">{term}</span>{' '}
                      {list.map((e, i) => (
                        <span key={e.anchor}>
                          {i > 0 && ', '}
                          <a href={`#/s/${e.sectionId}?mode=formal&at=${e.anchor}`}>{e.text.replace(/ \(.*\)$/, '')}</a>
                          <span className="muted small"> (§{sectionNumber.get(e.sectionId)})</span>
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
        <Attribution />
      </div>
    </div>
  );
}
