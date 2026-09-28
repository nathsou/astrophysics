import { sourceIndex, upstreamInfo } from '../content/source';
import report from '../content/source/report.json';
import { OVERRIDES } from '../formal/overrides';
import { ProvLegend } from '../ui/Prov';
import { Attribution } from './Attribution';
import type { Diagnostic } from '../content/schema';

export function About() {
  document.title = 'About this edition · Incompleteness and Computability';
  const diags = (report as { diagnostics: Diagnostic[] }).diagnostics;
  const w = upstreamInfo.work;
  return (
    <div className="page no-inspector">
      <div className="column about">
        <p className="kicker">About this edition</p>
        <h1>Sources, licence and changes</h1>

        <h2>The original work</h2>
        <p>
          <a href={w.url}>
            <em>{w.title}</em>
          </a>{' '}
          by <a href={w.authorUrl}>{w.author}</a>, {w.edition}, is part of <a href={w.projectUrl}>{w.project}</a>. It is licensed under the{' '}
          <a href={upstreamInfo.license.url}>{upstreamInfo.license.name}</a> licence. The text in Formal mode is converted from its LaTeX source; the sources used are:
        </p>
        <table className="about-table sans">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Pinned commit</th>
              <th>Files used</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(upstreamInfo.repositories).map(([name, r]) => (
              <tr key={name}>
                <td>
                  <a href={r.url}>{name}</a>
                </td>
                <td>
                  <a href={`${r.url}/tree/${r.commit}`}>
                    <code>{r.commit.slice(0, 10)}</code>
                  </a>
                </td>
                <td>
                  {r.paths.map((p) => (
                    <code key={p} className="path">
                      {p}
                    </code>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          No figures, photographs or other assets from the original are reused. The book’s cover and the portraits in its biographies chapter come from other sources and are
          not included.
        </p>

        <h2>What is changed</h2>
        <ul>
          <li>The LaTeX is converted to structured content by a converter written for this edition (see “Conversion” below). Apart from small corrections (below), the wording of the converted text is not edited.</li>
          <li>Each section is presented in three modes. Intuition and Explore modes, the workbenches, exercises, and the computed and checked panels in Formal mode are new.</li>
          <li>
            Formal mode keeps the book’s numbering: chapters 1–9 and appendices A–D, as in the book. References to parts of the Open Logic Project outside this book are shown
            as such.
          </li>
          <li>
            Where the book leaves a convention open, this edition fixes one and says so. In particular the official symbols of the language of arithmetic are taken to be 0 = c₀,
            ′ = f¹₀, + = f²₀, × = f²₁ and &lt; = P²₀; variables v₀, v₁, … are displayed x, y, z, u, w, x₀, y₀, …
          </li>
          <li>End-of-chapter problems are shown where they occur in the source rather than collected at the end of the chapter.</li>
          <li>
            Small slips in the printed text — a wrong index or equation reference, a misnamed function, a formula that does not say what the text means — are corrected in
            place. The corrections are applied to the LaTeX during conversion and kept, with their reasons, in <code>errata/</code> in the repository.
          </li>
        </ul>

        <h2>What everything is</h2>
        <ProvLegend />

        <h2>Conversion</h2>
        <p>
          The converter walks the book’s driver file <code>ic.tex</code> exactly as LaTeX would: it follows the chapter and section imports, selects material by the book’s tags,
          qualifies labels as the Open Logic referencing package does, and numbers environments per chapter. Macros are read from the upstream configuration files{' '}
          <code>open-logic-config.sty</code> and <code>ic-config.sty</code> by a small interpreter of LaTeX’s <code>xparse</code> declarations, so notation changes upstream
          flow through. A few macros are defined upstream with TeX primitives that the web renderer (KaTeX) cannot run; those are replaced explicitly:
        </p>
        <table className="about-table sans">
          <tbody>
            {Object.entries(OVERRIDES).map(([name, o]) => (
              <tr key={name}>
                <td>
                  <code>\{name}</code>
                </td>
                <td>{o.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Anything the converter does not understand is reported and displayed as written, never silently dropped. The current report:</p>
        <ul className="diag-list sans">
          {diags.length === 0 && <li>No diagnostics.</li>}
          {diags.map((d, i) => (
            <li key={i} className={`diag ${d.level}`}>
              <span className="diag-level">{d.level}</span> <code>{d.code}</code> {d.message}
              {d.loc && (
                <span className="muted">
                  {' '}
                  — {d.loc.file}:{d.loc.line}
                </span>
              )}
            </li>
          ))}
        </ul>
        <details>
          <summary className="sans">Macros used in the converted text ({sourceIndex.macros.length})</summary>
          <div className="macro-cloud">
            {sourceIndex.macros.map((m) => (
              <span key={m.name} className={`macro ${m.origin}`} title={`${m.origin}, used ${m.count}×`}>
                \{m.name} <span className="muted">{m.count}</span>
              </span>
            ))}
          </div>
        </details>

        <h2>Updating from upstream</h2>
        <p>
          The upstream files are vendored in <code>courses/incompleteness/upstream/</code> at the commits above. <code>npm run upstream:sync</code> copies newer versions from
          local checkouts, <code>npm run convert</code> regenerates the structured text, and the diff of <code>src/content/source/</code> shows exactly what changed. The build
          fails if the committed conversion is stale or has errors.
        </p>
        <Attribution />
      </div>
    </div>
  );
}
