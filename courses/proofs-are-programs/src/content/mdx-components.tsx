// Components available to chapters (MDX).

import { Dynamic } from 'solid-js/web';
import { For, Show, type JSX, children as resolveChildren } from 'solid-js';
import { CodeBlock } from '../viz/CodeBlock.tsx';
import { Playground } from '../viz/Playground.tsx';
import { rules } from '@kernel/core/rules.ts';
import katex from 'katex';
import { widgets } from '../viz/registry.ts';

type P = { children?: JSX.Element; [k: string]: unknown };

const passthrough = (tag: string) => (props: P) => <Dynamic component={tag} {...props} />;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');

function textOf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node instanceof Node) return node.textContent ?? '';
  if (typeof node === 'function') return textOf((node as () => unknown)());
  return '';
}

function Heading(level: 2 | 3 | 4) {
  return (props: P) => {
    const c = resolveChildren(() => props.children);
    const id = slugify(textOf(c()));
    const tag = `h${level}`;
    return (
      <Dynamic component={tag} id={id} data-toc={level <= 3 ? level : undefined}>
        {c()}
        <Show when={level <= 3}>
          <button
            class="anchor"
            aria-label="link to this section"
            onClick={() => {
              const url = new URL(location.href);
              const [path] = url.hash.slice(1).split('?');
              history.replaceState(null, '', `#${path}?s=${id}`);
              document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            #
          </button>
        </Show>
      </Dynamic>
    );
  };
}

export function RawHtml(props: { html: string; display?: boolean }) {
  return props.display ? <div class="katex-block" innerHTML={props.html} /> : <span innerHTML={props.html} />;
}

function Callout(kind: string, label: string) {
  return (props: { title?: string; children?: JSX.Element }) => (
    <div class={`callout ${kind}`}>
      <div class="callout-title">
        {label}
        <Show when={props.title}>
          <em>{props.title}</em>
        </Show>
      </div>
      {props.children}
    </div>
  );
}

export function Sidenote(props: { children?: JSX.Element }) {
  return <span class="sidenote">{props.children}</span>;
}

export function Tex(props: { children?: string; tex?: string; display?: boolean }) {
  const src = () => props.tex ?? String(props.children ?? '');
  return <RawHtml html={katex.renderToString(src(), { displayMode: props.display, throwOnError: false })} display={props.display} />;
}

/** display inference rules from the registry */
export function Rules(props: { ids: string; caption?: string }) {
  const list = () => props.ids.split(/[\s,]+/).filter(Boolean);
  return (
    <div class="rulebox wide">
      <For each={list()}>
        {(id) => {
          const r = rules[id];
          if (!r) return <span class="badge err">unknown rule {id}</span>;
          const tex = `\\dfrac{${r.premises.join('\\qquad ') || '\\vphantom{\\vdash}'}}{${r.conclusion}}`;
          return (
            <span class="rule" title={r.blurb}>
              <RawHtml html={katex.renderToString(tex, { throwOnError: false })} />
              <span class="rule-name">{r.name}</span>
              <Show when={r.side}>
                <RawHtml html={katex.renderToString(r.side!, { throwOnError: false })} />
              </Show>
            </span>
          );
        }}
      </For>
    </div>
  );
}

/** a custom inference rule written inline */
export function Rule(props: { name?: string; premises?: string; conclusion: string; side?: string }) {
  const prem = () => (props.premises ?? '').split('||').map((s) => s.trim()).filter(Boolean);
  const tex = () => `\\dfrac{${prem().join('\\qquad ') || '\\vphantom{\\vdash}'}}{${props.conclusion}}`;
  return (
    <span class="rule">
      <RawHtml html={katex.renderToString(tex(), { throwOnError: false })} />
      <Show when={props.name}>
        <span class="rule-name">{props.name}</span>
      </Show>
      <Show when={props.side}>
        <RawHtml html={katex.renderToString(props.side!, { throwOnError: false })} />
      </Show>
    </span>
  );
}

export function RuleRow(props: { children?: JSX.Element }) {
  return <div class="rulebox wide">{props.children}</div>;
}

export function Legend() {
  return (
    <div class="legend">
      <span style={{ color: 'var(--c-sort)' }}>sorts</span>
      <span style={{ color: 'var(--c-type)' }}>types</span>
      <span style={{ color: 'var(--c-prop)' }}>propositions</span>
      <span style={{ color: 'var(--c-proof)' }}>proofs</span>
      <span style={{ color: 'var(--c-ctor)' }}>constructors</span>
      <span style={{ color: 'var(--c-var)' }}>variables</span>
    </div>
  );
}

const tags = ['p', 'a', 'ul', 'ol', 'li', 'em', 'strong', 'del', 'blockquote', 'hr', 'br', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sup', 'sub', 'section', 'input', 'span', 'div', 'pre', 'code', 'h1', 'h5', 'h6'];

export const mdxComponents: Record<string, unknown> = {
  ...Object.fromEntries(tags.map((t) => [t, passthrough(t)])),
  h2: Heading(2),
  h3: Heading(3),
  h4: Heading(4),
  RawHtml,
  CodeBlock,
  Playground,
  Definition: Callout('definition', 'Definition'),
  Theorem: Callout('theorem', 'Theorem'),
  Note: Callout('note', 'Note'),
  Warning: Callout('warning', 'Careful'),
  History: Callout('history', 'History'),
  Engineer: Callout('engineer', 'For the engineer'),
  LeanNote: Callout('lean', 'In Lean 4'),
  Problem: Callout('problem', 'The problem'),
  Sidenote,
  Tex,
  Rules,
  Rule,
  RuleRow,
  Legend,
  ...widgets,
};
