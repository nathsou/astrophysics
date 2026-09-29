import { For, Show, createSignal } from 'solid-js';
import { highlight } from '../app/highlight.ts';

export function CodeBlock(props: { code: string; lang?: string; title?: string; context?: string }) {
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
        <Show when={props.lang === 'lean'}>
          <a class="btn small" href={`#/playground?code=${btoa(unescape(encodeURIComponent(props.context ? `-- (earlier in the chapter)\n${props.context}-- (this block)\n${props.code}` : props.code)))}`} title="open in the playground">
            try it
          </a>
        </Show>
        <button class="btn small" onClick={copy}>
          {copied() ? 'copied' : 'copy'}
        </button>
      </div>
      <Show when={props.lang && props.lang !== 'lean'}>
        <span class="cb-lang">{props.lang}</span>
      </Show>
    </div>
  );
}
