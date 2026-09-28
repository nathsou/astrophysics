import { useParams, A } from '@solidjs/router';
import { For, Show, Switch, Match, createSignal } from 'solid-js';
import { rules } from '../kernel/core/rules.ts';
import { RawHtml } from '../content/mdx-components.tsx';
import katex from 'katex';
import { timeline, glossary, bibliography } from '../content/reference.ts';
import { chapterBySlug } from '../content/chapters.ts';

const tex = (s: string) => katex.renderToString(s, { throwOnError: false });
const md = (s: string) => s.replace(/\*([^*]+)\*/g, '<em>$1</em>');

function RuleIndex() {
  const groups: [string, string][] = [
    ['stlc.', 'Simply typed λ-calculus (Chapter 3)'],
    ['f.', 'System F (Chapter 5)'],
    ['pts.', 'Pure Type Systems (Chapter 8)'],
    ['', 'The kernel’s rules (Chapter 17)'],
    ['ind.', 'Inductive types (Chapter 11)'],
  ];
  const inGroup = (id: string, prefix: string) => (prefix ? id.startsWith(prefix) : !id.includes('.'));
  return (
    <>
      <div class="chapter-kicker">-- reference · inference rules</div>
      <h1>Rule index</h1>
      <p>Every inference rule displayed in the course. The kernel’s derivation trees refer to the rules in the fourth group.</p>
      <For each={groups}>
        {([prefix, title]) => (
          <>
            <h2>{title}</h2>
            <div class="rule-list">
              <For each={Object.values(rules).filter((r) => inGroup(r.id, prefix))}>
                {(r) => (
                  <div class="rule-card">
                    <div class="rule-card-formula">
                      <RawHtml html={tex(`\\dfrac{${r.premises.join('\\qquad ') || '\\vphantom{\\vdash}'}}{${r.conclusion}}${r.side ? `\;\; ${r.side}` : ''}`)} />
                    </div>
                    <div class="rule-card-text">
                      <b>{r.name}</b> — {r.blurb}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </>
        )}
      </For>
    </>
  );
}

function Timeline() {
  const [sel, setSel] = createSignal(timeline.length - 1);
  const min = 1895;
  const max = 2028;
  const tracks = ['logic', 'lambda', 'types', 'systems'] as const;
  const trackName = { logic: 'Logic', lambda: 'λ-calculus', types: 'Type theory', systems: 'Systems' };
  const W = 1000;
  const x = (y: number) => 60 + ((y - min) / (max - min)) * (W - 80);
  const rowY = (t: string) => 40 + tracks.indexOf(t as (typeof tracks)[number]) * 46;
  const e = () => timeline[sel()];
  return (
    <>
      <div class="chapter-kicker">-- reference · history</div>
      <h1>Timeline</h1>
      <p>A century of ideas behind the Calculus of Inductive Constructions. Click an event.</p>
      <div class="widget wide timeline">
        <svg viewBox={`0 0 ${W} 230`} class="tl-svg">
          <For each={tracks}>
            {(t) => (
              <>
                <line x1={50} x2={W - 10} y1={rowY(t)} y2={rowY(t)} class="tl-track" />
                <text x={4} y={rowY(t) + 4} class="tl-track-label">
                  {trackName[t]}
                </text>
              </>
            )}
          </For>
          <For each={[1900, 1920, 1940, 1960, 1980, 2000, 2020]}>
            {(y) => (
              <>
                <line x1={x(y)} x2={x(y)} y1={20} y2={200} class="tl-grid" />
                <text x={x(y)} y={218} text-anchor="middle" class="tl-year">
                  {y}
                </text>
              </>
            )}
          </For>
          <For each={timeline}>
            {(ev, i) => (
              <circle cx={x(ev.year)} cy={rowY(ev.track)} r={sel() === i() ? 8 : 5.5} class={`tl-dot t-${ev.track} ${sel() === i() ? 'on' : ''}`} onClick={() => setSel(i())} onMouseEnter={() => setSel(i())}>
                <title>
                  {ev.year}: {ev.title}
                </title>
              </circle>
            )}
          </For>
        </svg>
        <div class="tl-card">
          <div class="tl-card-year">{e().year}</div>
          <div>
            <div class="tl-card-title">{e().title}</div>
            <div class="muted">{e().who}</div>
            <p style={{ margin: '0.3rem 0 0' }}>{e().text}</p>
            <Show when={e().ch && chapterBySlug(e().ch!)}>
              <A href={`/ch/${e().ch}`} class="sans" style={{ 'font-size': '0.85rem' }}>
                → {chapterBySlug(e().ch!)!.title}
              </A>
            </Show>
          </div>
        </div>
      </div>
      <table>
        <tbody>
          <For each={timeline}>
            {(ev) => (
              <tr>
                <td class="sans" style={{ 'font-variant-numeric': 'tabular-nums' }}>
                  {ev.year}
                </td>
                <td>
                  <b>{ev.title}</b> <span class="muted">— {ev.who}</span>
                  <br />
                  {ev.text}
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </>
  );
}

function Glossary() {
  const [q, setQ] = createSignal('');
  const items = () => glossary.filter((g) => (g.term + g.def).toLowerCase().includes(q().toLowerCase())).sort((a, b) => a.term.localeCompare(b.term));
  return (
    <>
      <div class="chapter-kicker">-- reference · terms</div>
      <h1>Glossary</h1>
      <input class="input" placeholder="search…" value={q()} onInput={(e) => setQ(e.currentTarget.value)} style={{ width: '100%', 'margin-bottom': '1rem' }} />
      <dl class="glossary">
        <For each={items()}>
          {(g) => (
            <>
              <dt>{g.term}</dt>
              <dd>
                {g.def}{' '}
                <A href={`/ch/${g.ch}`} class="sans" style={{ 'font-size': '0.8rem' }}>
                  ({chapterBySlug(g.ch)?.title})
                </A>
              </dd>
            </>
          )}
        </For>
      </dl>
    </>
  );
}

function Bibliography() {
  return (
    <>
      <div class="chapter-kicker">-- reference · bibliography</div>
      <h1>Further reading</h1>
      <p>Classic papers and books behind each chapter.</p>
      <For each={bibliography}>
        {(b) => (
          <>
            <h3>
              <A href={`/ch/${b.ch}`}>{chapterBySlug(b.ch)?.title}</A>
            </h3>
            <ul>
              <For each={b.items}>{(it) => <li innerHTML={md(it)} />}</For>
            </ul>
          </>
        )}
      </For>
    </>
  );
}

export default function ReferencePage() {
  const params = useParams();
  return (
    <div class="page ref" style={{ 'grid-template-columns': 'minmax(0, 1fr)' }}>
      <article class="prose">
        <Switch fallback={<p>Unknown page.</p>}>
          <Match when={params.page === 'rules'}>
            <RuleIndex />
          </Match>
          <Match when={params.page === 'timeline'}>
            <Timeline />
          </Match>
          <Match when={params.page === 'glossary'}>
            <Glossary />
          </Match>
          <Match when={params.page === 'bibliography'}>
            <Bibliography />
          </Match>
        </Switch>
      </article>
    </div>
  );
}
