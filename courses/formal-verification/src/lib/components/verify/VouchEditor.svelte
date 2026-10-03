<!--
  A Vouch editor connected to the language server (in a Web Worker): diagnostics, hover, completion, signature
  help, go to definition (F12), references (Shift-F12), rename (F2), semantic highlighting, inlay hints, and the
  verdicts of the engines as seals in the gutter. `locked` lines cannot be edited (exercises).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { EditorView } from '@codemirror/view';
  import { freshUri, vouchClient, type RangedVerdict, type VerdictsPayload } from './lsp';

  let {
    value,
    name = 'scratch',
    locked = [],
    readonly = false,
    minLines = 10,
    maxHeight,
    label = 'Vouch editor',
    lsp = true,
    onchange,
    onverdicts,
    onselect,
    onrun,
    ondone,
  }: {
    value: string;
    name?: string;
    /** 1-based inclusive line ranges that cannot be edited. */
    locked?: [number, number][];
    readonly?: boolean;
    minLines?: number;
    maxHeight?: string;
    label?: string;
    /** Connect to the language server (false: highlighting only). */
    lsp?: boolean;
    onchange?: (code: string) => void;
    onverdicts?: (p: VerdictsPayload) => void;
    onselect?: (v: RangedVerdict) => void;
    onrun?: () => void;
    ondone?: () => void;
  } = $props();

  let host: HTMLDivElement;
  let view = $state<EditorView | undefined>();
  const uri = freshUri(name);
  let status = $state<'loading' | 'ready' | 'offline'>('loading');

  /** Replace the document (e.g. reset to the starter code). */
  export function setValue(code: string) {
    if (view && view.state.doc.toString() !== code) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
  }
  export function getValue(): string {
    return view?.state.doc.toString() ?? value;
  }
  export function focus() {
    view?.focus();
  }
  /** Move the cursor to a 0-based line and character, and scroll it into view. */
  export function reveal(line: number, character = 0) {
    if (!view) return;
    const l = view.state.doc.line(Math.min(line + 1, view.state.doc.lines));
    const pos = Math.min(l.from + character, l.to);
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    view.focus();
  }
  /** Ask the server to verify now (instead of waiting for the pause after typing). */
  export async function verify(): Promise<void> {
    const c = await vouchClient();
    c.client.sync();
    await c.client.request('vouch/verify', { textDocument: { uri } });
  }

  onMount(() => {
    let destroyed = false;
    const cleanups: (() => void)[] = [];
    (async () => {
      const [{ EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection }, { EditorState }, cmds, lang, auto, lint, cm, lspmod] = await Promise.all([
        import('@codemirror/view'),
        import('@codemirror/state'),
        import('@codemirror/commands'),
        import('@codemirror/language'),
        import('@codemirror/autocomplete'),
        import('@codemirror/lint'),
        import('./cm'),
        import('@codemirror/lsp-client'),
      ]);
      if (destroyed) return;
      let client: Awaited<ReturnType<typeof vouchClient>> | undefined;
      if (lsp && !readonly) {
        try {
          client = await vouchClient();
        } catch {
          status = 'offline';
        }
      }
      if (destroyed) return;
      const base = EditorState.create({ doc: value });
      view = new EditorView({
        parent: host,
        state: EditorState.create({
          doc: value,
          extensions: [
            lineNumbers(),
            ...(client ? [cm.verdictGutter((v) => onselect?.(v))] : []),
            highlightActiveLineGutter(),
            highlightActiveLine(),
            drawSelection(),
            cmds.history(),
            lang.indentOnInput(),
            lang.bracketMatching(),
            auto.closeBrackets(),
            lint.lintGutter(),
            EditorState.tabSize.of(2),
            EditorState.readOnly.of(readonly),
            EditorView.editable.of(!readonly),
            EditorView.contentAttributes.of({ 'aria-label': label }),
            keymap.of([
              { key: 'Mod-Enter', run: () => (onrun ? (onrun(), true) : (void verify(), true)) },
              ...auto.closeBracketsKeymap,
              ...cmds.defaultKeymap,
              ...cmds.historyKeymap,
              ...lspmod.jumpToDefinitionKeymap,
              ...lspmod.findReferencesKeymap,
              ...lspmod.renameKeymap,
              ...lspmod.signatureKeymap,
              cmds.indentWithTab,
            ]),
            cm.vouchTheme,
            maxHeight ? EditorView.theme({ '.cm-scroller': { maxHeight } }) : [],
            EditorView.theme({ '.cm-content, .cm-gutter': { minHeight: `${minLines * 1.62 * 0.86}rem` } }),
            ...(client ? [client.client.plugin(uri, 'vouch'), cm.serverHighlighting(client.client, uri)] : [cm.lexerHighlighting()]),
            ...(locked.length ? [cm.lockedLines(base, locked)] : []),
            EditorView.updateListener.of((u) => {
              if (u.docChanged) onchange?.(u.state.doc.toString());
            }),
          ],
        }),
      });
      if (client) {
        status = 'ready';
        cleanups.push(
          client.onVerdicts(uri, (p) => {
            if (view) cm.showVerdicts(view, p);
            onverdicts?.(p);
          }),
          client.onDone(uri, () => ondone?.()),
        );
      } else if (!lsp || readonly) status = 'ready';
    })();
    return () => {
      destroyed = true;
      for (const c of cleanups) c();
      view?.destroy();
    };
  });
</script>

<div class="editor" class:readonly bind:this={host} data-status={status}>
  {#if !view}
    <pre class="fallback">{value}</pre>
  {/if}
</div>

<style>
  .editor {
    position: relative;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--panel);
  }
  .fallback {
    margin: 0;
    padding: 0.6rem 1rem 0.6rem 3.4rem;
    font-family: var(--font-mono);
    font-size: 0.86rem;
    line-height: 1.62;
    white-space: pre;
    overflow-x: auto;
    color: var(--ink-2);
  }
</style>
