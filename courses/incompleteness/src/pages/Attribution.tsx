import type { SourceLoc } from '../content/schema';
import { sourceUrl, upstreamInfo } from '../content/source';

/** The attribution required by CC BY 4.0, on every page. */
export function Attribution({ section }: { section?: { loc: SourceLoc; title: string } }) {
  const w = upstreamInfo.work;
  return (
    <footer className="footer">
      Adapted from{' '}
      <a href={w.url} target="_blank" rel="noreferrer">
        <em>Incompleteness and Computability</em>
      </a>{' '}
      by{' '}
      <a href={w.authorUrl} target="_blank" rel="noreferrer">
        Richard Zach
      </a>{' '}
      and the{' '}
      <a href={w.projectUrl} target="_blank" rel="noreferrer">
        Open Logic Project
      </a>
      , licensed under{' '}
      <a href={upstreamInfo.license.url} target="_blank" rel="noreferrer">
        CC BY 4.0
      </a>
      . This edition converts the LaTeX source, corrects small slips, rearranges it into modes, and adds explanations, workbenches and exercises; see the{' '}
      <a href="#/about">About page</a>.
      {section && (
        <>
          {' '}
          This section’s source:{' '}
          <a href={sourceUrl(section.loc)} target="_blank" rel="noreferrer">
            {section.loc.file}
          </a>{' '}
          (commit {upstreamInfo.repositories[section.loc.repo].commit.slice(0, 7)}).
        </>
      )}
    </footer>
  );
}
