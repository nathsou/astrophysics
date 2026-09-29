<!--
  The DCL editor as a component (see index.ts for what it does).

    <DclEditor bind:doc onchange={…} analyze={…} onanalysis={…} onpointer={…} probe={ranges} />

  Server-side (and until CodeMirror has loaded) it shows the code as a static, highlighted block with the
  same structure as the code blocks in chapters, so the page is readable without JavaScript and does not
  jump when the editor appears.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { highlightDclHtml } from './highlightHtml';
  import type { Analysis, DclEditor, FormatOutcome, Range } from './index';

  let {
    doc = $bindable(''),
    readonly = false,
    label = 'DCL source code',
    analyze,
    onanalysis,
    onpointer,
    onformat,
    probe = [],
    minLines = 4,
    maxLines = 40,
    lineNumbers = true,
    delay,
  }: {
    doc?: string;
    readonly?: boolean;
    label?: string;
    analyze?: (source: string) => Promise<Analysis | undefined>;
    onanalysis?: (a: Analysis) => void;
    onpointer?: (hit: { offset: number; line: number; gutter?: boolean } | null) => void;
    onformat?: (outcome: FormatOutcome) => void;
    /** Source ranges to mark (the source of the gates being probed). */
    probe?: Range[];
    minLines?: number;
    /** The editor grows with the text up to this many lines, then scrolls. */
    maxLines?: number;
    lineNumbers?: boolean;
    delay?: number;
  } = $props();

  let host: HTMLDivElement | undefined = $state();
  let editor: DclEditor | undefined = $state();
  let ready = $state(false);

  const lines = $derived(Math.max(minLines, Math.min(maxLines, doc.split('\n').length)));
  // 1.62 line height × 0.84rem font, plus the padding of the content.
  const height = $derived(`calc(${lines} * 1.62 * 0.84rem + 1.4rem + 2px)`);

  export function getEditor(): DclEditor | undefined {
    return editor;
  }
  export function focus(): void {
    editor?.focus();
  }
  export function format(): FormatOutcome | undefined {
    return editor?.format();
  }
  export function reveal(offset: number): void {
    editor?.reveal(offset);
  }

  onMount(() => {
    let disposed = false;
    let made: DclEditor | undefined;
    import('./index').then(({ createDclEditor }) => {
      if (disposed || !host) return;
      made = createDclEditor(host, {
        doc: untrack(() => doc),
        readOnly: untrack(() => readonly),
        ariaLabel: label,
        lineNumbers,
        delay,
        analyze,
        onAnalysis: (a) => onanalysis?.(a),
        onPointer: (h) => onpointer?.(h),
        onFormat: (o) => onformat?.(o),
        onChange: (text) => {
          doc = text;
        },
      });
      editor = made;
      ready = true;
    });
    return () => {
      disposed = true;
      made?.destroy();
      editor = undefined;
    };
  });

  // The document was replaced from outside.
  $effect(() => {
    const text = doc;
    if (editor && editor.getDoc() !== text) editor.setDoc(text);
  });
  $effect(() => {
    editor?.setReadOnly(readonly);
  });
  $effect(() => {
    editor?.setProbe(probe);
  });
</script>

<div class="dcl-editor" class:ready style:height>
  <div class="cm" bind:this={host} hidden={!ready}></div>
  {#if !ready}
    <div class="static">{@html highlightDclHtml(doc)}</div>
  {/if}
</div>

<style>
  .dcl-editor {
    position: relative;
    min-width: 0;
  }
  .cm {
    height: 100%;
  }
  .cm[hidden] {
    display: none;
  }
  .static {
    height: 100%;
    overflow: auto;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .static :global(pre) {
    margin: 0;
    padding: 0.7rem 0.9rem 0.7rem 1.1rem;
    font-family: var(--font-mono);
    font-size: 0.84rem;
    line-height: 1.62;
    background: transparent !important;
    min-width: max-content;
  }
</style>
