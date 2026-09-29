import { For, Show, createSignal } from 'solid-js';
import { highlight } from '../app/highlight.ts';

export function CodeBlock(props: { code: string; lang?: string; title?: string }) {
  const toks = () => highlight(props.code.replace(/\n$/, ''), props.lang ?? '');
  const [copied, setCopied] = createSignal(false);
  const copy = () => {
    navigator.clipboard?.writeText(props.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <div class="codeblock">
      <pre>
        <code>
          <For each={toks()}>{(t) => (t.cls ? <span class={t.cls}>{t.text}</span> : t.text)}</For>
        </code>
      </pre>
      <div class="cb-actions">
        <button class="btn small" onClick={copy}>
          {copied() ? 'copied' : 'copy'}
        </button>
      </div>
      <Show when={props.lang}>
        <span class="cb-lang">{props.lang === 'lean' ? 'Lean 4' : props.lang}</span>
      </Show>
    </div>
  );
}
