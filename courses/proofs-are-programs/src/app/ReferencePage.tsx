import { useParams, A } from '@solidjs/router';
import { For, Show, Switch, Match, createSignal } from 'solid-js';
import { tactics, language, dictionary, glossary, reading } from '../content/reference.ts';
import { chapterBySlug, chapters, chapterLabel } from '../content/chapters.ts';
import { CodeBlock } from '../viz/CodeBlock.tsx';
import { cicHref, CIC_TITLES, CIC_NUMBERS } from '../content/bridges.ts';

function ChLink(props: { slug: string }) {
  const c = () => chapterBySlug(props.slug);
  return (
    <Show when={c()}>
      <A href={`/ch/${props.slug}`} class="ref-ch">
        {chapterLabel(c()!)}
      </A>
    </Show>
  );
}

function Tactics() {
  const [q, setQ] = createSignal('');
  const shown = () => tactics.filter((t) => (t.name + t.what).toLowerCase().includes(q().toLowerCase()));
  return (
    <>
      <h1>Tactic reference</h1>
      <p>
        Every tactic of the course language, what it does, and the piece of proof term it writes. Tactics never make the kernel accept anything: the term they build is checked like any other.
      </p>
      <input class="input ref-search" placeholder="search tactics…" value={q()} onInput={(e) => setQ(e.currentTarget.value)} />
      <div class="ref-list">
        <For each={shown()}>
          {(t) => (
            <div class="ref-card" id={t.name}>
              <div class="ref-card-head">
                <b class="mono">{t.name}</b>
                <span class="grow" />
                <ChLink slug={t.ch} />
              </div>
              <div class="ref-syntax">
                <For each={t.syntax}>{(s) => <code class="mono">{s}</code>}</For>
              </div>
              <p>{t.what}</p>
              <div class="ref-term">
                <span class="label">writes</span> <code class="mono">{t.term}</code>
              </div>
              <Show when={t.example}>
                <CodeBlock code={t.example!} lang="lean" />
              </Show>
            </div>
          )}
        </For>
      </div>
    </>
  );
}

function Language() {
  return (
    <>
      <h1>Language reference</h1>
      <p>
        The course language is modelled on Lean 4 and runs on the same kernel as the <a href="../cic/">CIC course</a>. What you learn transfers to Lean 4 almost directly; the main differences are listed in the <A href="/ch/epilogue">epilogue</A>.
      </p>
      <div class="ref-list">
        <For each={language}>
          {(s) => (
            <div class="ref-card">
              <div class="ref-card-head">
                <b>{s.what}</b>
                <span class="grow" />
                <ChLink slug={s.ch} />
              </div>
              <CodeBlock code={s.syntax} lang="lean" />
              <p>{s.note}</p>
            </div>
          )}
        </For>
      </div>
    </>
  );
}

function Dictionary() {
  return (
    <>
      <h1>The Curry–Howard dictionary</h1>
      <p>Each row reads in two directions: from logic to programs, and back.</p>
      <table class="dict">
        <thead>
          <tr>
            <th>Logic</th>
            <th>Programs and types</th>
            <th>In the course language</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <For each={dictionary}>
            {(r) => (
              <tr>
                <td>{r.logic}</td>
                <td>{r.types}</td>
                <td>
                  <code class="mono">{r.syntax}</code>
                </td>
                <td>
                  <ChLink slug={r.ch} />
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </>
  );
}

function Bridges() {
  return (
    <>
      <h1>This course and the CIC course</h1>
      <p>
        <a href="../cic/">The Calculus of Inductive Constructions</a> explains how the kernel that checks everything here works: the typing rules, inductive types, universes, and why each restriction is needed. This course uses that kernel. The two share one language and one implementation (<code>packages/kernel</code> in the repository), so any snippet can be opened in the other course's playground with the <b>⇄ CIC</b> button.
      </p>
      <table class="dict">
        <thead>
          <tr>
            <th>Proofs Are Programs</th>
            <th>The theory behind it, in the CIC course</th>
          </tr>
        </thead>
        <tbody>
          <For each={chapters.filter((c) => c.cic?.length)}>
            {(c) => (
              <tr>
                <td>
                  <A href={`/ch/${c.slug}`}>
                    {chapterLabel(c)}: {c.title}
                  </A>
                </td>
                <td>
                  <For each={c.cic}>
                    {(l) => (
                      <div>
                        <a href={cicHref(l.slug, l.s)}>
                          CIC {CIC_NUMBERS[l.slug]}: {CIC_TITLES[l.slug]}
                        </a>{' '}
                        <span class="muted">— {l.what}</span>
                      </div>
                    )}
                  </For>
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
  return (
    <>
      <h1>Glossary</h1>
      <dl class="glossary">
        <For each={[...glossary].sort((a, b) => a.term.localeCompare(b.term))}>
          {(g) => (
            <>
              <dt id={g.term}>{g.term}</dt>
              <dd>
                {g.def} <Show when={g.ch}>{(ch) => <ChLink slug={ch()} />}</Show>
              </dd>
            </>
          )}
        </For>
      </dl>
    </>
  );
}

function Reading() {
  return (
    <>
      <h1>Further reading</h1>
      <ul class="reading">
        <For each={reading}>
          {(r) => (
            <li>
              <Show when={r.url} fallback={<span>{r.cite}</span>}>
                <a href={r.url}>{r.cite}</a>
              </Show>
              <div class="muted">{r.note}</div>
            </li>
          )}
        </For>
      </ul>
    </>
  );
}

export default function ReferencePage() {
  const params = useParams();
  return (
    <div class="page" style={{ 'grid-template-columns': 'minmax(0, 1fr)' }}>
      <article class="prose reference">
        <Switch fallback={<p>Unknown page.</p>}>
          <Match when={params.page === 'tactics'}>
            <Tactics />
          </Match>
          <Match when={params.page === 'language'}>
            <Language />
          </Match>
          <Match when={params.page === 'dictionary'}>
            <Dictionary />
          </Match>
          <Match when={params.page === 'bridges'}>
            <Bridges />
          </Match>
          <Match when={params.page === 'glossary'}>
            <Glossary />
          </Match>
          <Match when={params.page === 'reading'}>
            <Reading />
          </Match>
        </Switch>
      </article>
    </div>
  );
}
