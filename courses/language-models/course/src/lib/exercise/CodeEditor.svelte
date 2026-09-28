<!--
  CodeMirror 6 editor themed with the course tokens. TypeScript intelligence (completions, hover
  types, diagnostics) attaches lazily on first focus so pages with many editors stay light.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { EditorView } from '@codemirror/view';

  let {
    value,
    path,
    readonly = false,
    typescript = true,
    onchange,
    onrun,
    minLines = 8,
    label = 'Code editor',
  }: {
    value: string;
    /** Virtual file path; editors sharing a path share a TS file. */
    path: string;
    readonly?: boolean;
    typescript?: boolean;
    onchange?: (code: string) => void;
    onrun?: () => void;
    minLines?: number;
    label?: string;
  } = $props();

  let host: HTMLDivElement;
  let view = $state<EditorView | undefined>();
  let lsState = $state<'off' | 'loading' | 'on' | 'failed'>('off');

  /** Replace the document (e.g. reset to starter code). */
  export function setValue(code: string) {
    if (view && view.state.doc.toString() !== code) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
  }

  onMount(() => {
    let destroyed = false;
    (async () => {
      const [{ EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection }, { EditorState, Compartment }, cmds, lang, { javascript }, auto, { lintGutter }, { highlightStyle }] =
        await Promise.all([
          import('@codemirror/view'),
          import('@codemirror/state'),
          import('@codemirror/commands'),
          import('@codemirror/language'),
          import('@codemirror/lang-javascript'),
          import('@codemirror/autocomplete'),
          import('@codemirror/lint'),
          import('./editorTheme'),
        ]);
      if (destroyed) return;
      const tsCompartment = new Compartment();

      const theme = EditorView.theme({
        '&': { fontSize: '0.8125rem', backgroundColor: 'transparent', color: 'var(--fg)' },
        '.cm-content': { fontFamily: 'var(--font-mono)', padding: '0.6rem 0', caretColor: 'var(--ac)' },
        '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.7', minHeight: `${minLines * 1.7 * 0.8125 + 1.2}rem` },
        '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--ink-3)', border: 'none' },
        '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--ac) 7%, transparent)' },
        '.cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--ac) 12%, transparent)', color: 'var(--fg)' },
        '&.cm-focused': { outline: 'none' },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--term-hl-strong) !important' },
        '.cm-cursor': { borderLeftColor: 'var(--ac)', borderLeftWidth: '2px' },
        '.cm-tooltip': { backgroundColor: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: '4px', boxShadow: 'var(--shadow-lg)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' },
        '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--accent-soft)', color: 'var(--fg)' },
        '.cm-tooltip-hover': { padding: '0.4rem 0.6rem', maxWidth: '36rem' },
        '.cm-diagnostic': { fontFamily: 'var(--font-ui)', fontSize: '0.8rem' },
        '.cm-matchingBracket': { backgroundColor: 'color-mix(in srgb, var(--ac) 22%, transparent)', outline: 'none' },
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
            tsCompartment.of([auto.autocompletion()]),
            EditorView.updateListener.of((u) => {
              if (u.docChanged) onchange?.(u.state.doc.toString());
              if (u.focusChanged && u.view.hasFocus && typescript && !readonly && lsState === 'off') attachTs();
            }),
          ],
        }),
      });

      async function attachTs() {
        lsState = 'loading';
        try {
          const [{ tsService }, cmts] = await Promise.all([import('./tsService'), import('@valtown/codemirror-ts')]);
          const worker = await tsService();
          view?.dispatch({
            effects: tsCompartment.reconfigure([
              cmts.tsFacetWorker.of({ worker, path }),
              cmts.tsSyncWorker(),
              cmts.tsLinterWorker(),
              auto.autocompletion({ override: [cmts.tsAutocompleteWorker()] }),
              cmts.tsHoverWorker(),
            ]),
          });
          lsState = 'on';
        } catch (e) {
          console.warn('TypeScript service unavailable', e);
          lsState = 'failed';
        }
      }
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
  {#if typescript && !readonly && lsState !== 'off'}
    <span class="ls ui" title="TypeScript language service">{lsState === 'loading' ? 'loading types…' : lsState === 'on' ? 'TS' : 'no types'}</span>
  {/if}
</div>

<style>
  .editor {
    position: relative;
    background: var(--pn);
  }
  .fallback {
    margin: 0;
    padding: 0.6rem 1rem 0.6rem 3rem;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.7;
    white-space: pre;
    overflow-x: auto;
    color: var(--ink-2);
  }
  .ls {
    position: absolute;
    right: 0.5rem;
    bottom: 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    color: var(--ink-3);
    padding: 0.05rem 0.4rem;
    pointer-events: none;
  }
  .readonly {
    opacity: 0.95;
  }
</style>
