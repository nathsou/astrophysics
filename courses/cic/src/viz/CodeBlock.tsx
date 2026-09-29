import { For, Show, createSignal, type JSX } from 'solid-js';
import { highlight, languageLabel } from '../app/highlight.ts';

export function CodeBlock(props: { code: string; lang?: string; title?: string; /** inline marker after the last line, e.g. a ✓ */ mark?: JSX.Element }) {
  const toks = () => highlight(props.code.replace(/\n$/, ''), props.lang ?? '');
  const [copied, setCopied] = createSignal(false);
  const copy = () => {
    navigator.clipboard?.writeText(props.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };
  const label = () => props.title ?? languageLabel(props.lang);
  return (
    <div class="codeblock" data-lang={props.lang || undefined}>
      <div class="cb-head">
        <span class="cb-lang">{label()}</span>
        <button class="cb-copy" onClick={copy} aria-label={copied() ? 'Copied to the clipboard' : `Copy ${label() || 'code'} to the clipboard`}>
          <span aria-hidden="true">{copied() ? '✓ copied' : 'copy'}</span>
        </button>
      </div>
      <pre>
        <code>
          <For each={toks()}>{(t) => (t.cls ? <span class={t.cls}>{t.text}</span> : t.text)}</For>
          {props.mark}
        </code>
      </pre>
      <Show when={copied()}>
        <span class="sr-only" role="status">
          Copied
        </span>
      </Show>
    </div>
  );
}
