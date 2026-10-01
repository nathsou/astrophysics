<!--
  CodeMirror 6 editor themed with the course tokens. Plain TypeScript syntax highlighting; the tests in the exercise check the code.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { EditorView } from '@codemirror/view';

  let {
    value,
    path,
    readonly = false,
    onchange,
    onrun,
    minLines = 8,
    label = 'Code editor',
  }: {
    value: string;
    /** Virtual file path; editors sharing a path share a TS file. */
    path: string;
    readonly?: boolean;
    onchange?: (code: string) => void;
    onrun?: () => void;
    minLines?: number;
    label?: string;
  } = $props();

  let host: HTMLDivElement;
  let view = $state<EditorView | undefined>();

  /** Replace the document (e.g. reset to starter code). */
  export function setValue(code: string) {
    if (view && view.state.doc.toString() !== code) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
  }

  onMount(() => {
    let destroyed = false;
    (async () => {
      const [{ EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection }, { EditorState }, cmds, lang, { javascript }, auto, { lintGutter }, { highlightStyle }] =
        await Promise.all([
          import('@codemirror/view'),
          import('@codemirror/state'),
          import('@codemirror/commands'),
          import('@codemirror/language'),
          import('@codemirror/lang-javascript'),
          import('@codemirror/autocomplete'),
          import('@codemirror/lint'),
          import('$lib/code/editorTheme'),
        ]);
      if (destroyed) return;
      
      const theme = EditorView.theme({
        '&': { fontSize: '0.84rem', backgroundColor: 'var(--surface)', color: 'var(--ink)' },
        '.cm-content': { fontFamily: 'var(--font-mono)', padding: '0.6rem 0', caretColor: 'var(--accent-2)' },
        '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6', minHeight: `${minLines * 1.6 * 0.84 + 1.2}rem` },
        '.cm-gutters': { backgroundColor: 'var(--surface-2)', color: 'var(--ink-3)', border: 'none', borderRight: '1px solid var(--border)' },
        '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent-2) 5%, transparent)' },
        '.cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--accent-2) 10%, transparent)', color: 'var(--ink)' },
        '&.cm-focused': { outline: 'none' },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--term-hl-strong) !important' },
        '.cm-cursor': { borderLeftColor: 'var(--accent-2)', borderLeftWidth: '2px' },
        '.cm-tooltip': { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow-lg)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' },
        '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--accent-soft)', color: 'var(--ink)' },
        '.cm-tooltip-hover': { padding: '0.4rem 0.6rem', maxWidth: '36rem' },
        '.cm-diagnostic': { fontFamily: 'var(--font-ui)', fontSize: '0.8rem' },
        '.cm-matchingBracket': { backgroundColor: 'var(--surface-3)', outline: 'none' },
      });

      view = new EditorView({
        parent: host,
        state: EditorState.create({
          doc: value,
          extensions: [
            lineNumbers(),
            highlightActiveLineGutter(),
            highlightActiveLine(),
            drawSelection(),
            cmds.history(),
            lang.indentOnInput(),
            lang.bracketMatching(),
            auto.closeBrackets(),
            lang.syntaxHighlighting(highlightStyle),
            javascript({ typescript: true }),
            lintGutter(),
            EditorState.tabSize.of(2),
            EditorState.readOnly.of(readonly),
            EditorView.editable.of(!readonly),
            EditorView.contentAttributes.of({ 'aria-label': label }),
            keymap.of([
              { key: 'Mod-Enter', run: () => (onrun?.(), true) },
              ...auto.closeBracketsKeymap,
              ...cmds.defaultKeymap,
              ...cmds.historyKeymap,
              cmds.indentWithTab,
            ]),
            theme,
            auto.autocompletion(),
            EditorView.updateListener.of((u) => {
              if (u.docChanged) onchange?.(u.state.doc.toString());
            }),
          ],
        }),
      });

    })();
    return () => {
      destroyed = true;
      view?.destroy();
    };
  });
</script>

<div class="editor" class:readonly bind:this={host}>
  {#if !view}
    <pre class="fallback">{value}</pre>
  {/if}
</div>

<style>
  .editor {
    position: relative;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .fallback {
    margin: 0;
    padding: 0.6rem 1rem 0.6rem 3rem;
    font-family: var(--font-mono);
    font-size: 0.84rem;
    line-height: 1.6;
    white-space: pre;
    overflow-x: auto;
    color: var(--ink-2);
  }
  .readonly {
    opacity: 0.95;
  }
</style>
