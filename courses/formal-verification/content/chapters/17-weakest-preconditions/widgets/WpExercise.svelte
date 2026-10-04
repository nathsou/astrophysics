<!--
  Find the weakest precondition by hand: the reader types a precondition for a function; the solver checks that it
  is strong enough (it implies the wp of the body) and that it is the weakest (the wp implies it). Counterexamples
  are shown for either failure.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import ExerciseFrame from '$lib/components/exercise/ExerciseFrame.svelte';
  import { computeWp, formulaFromText, fromVouch, showFormula, valid, WpError } from '$lib/fv/wp/wp';
  import { imp } from '$lib/fv/logic/term';
  import { progress } from '$lib/state/progress.svelte';

  let { id, code, title, prompt, hints = [] }: { id: string; code: string; title?: string; prompt?: string; hints?: string[] } = $props();

  // svelte-ignore state_referenced_locally
  const prog = fromVouch(code);
  const wp = computeWp(prog).wp;
  let text = $state('');
  let out = $state<{ ok: boolean; lines: string[] } | undefined>();

  onMount(() => {
    progress.load();
    text = progress.draft<string>(id, '');
  });

  function check() {
    progress.saveDraft(id, text);
    let p;
    try {
      p = formulaFromText(prog, text);
    } catch (e) {
      out = { ok: false, lines: [e instanceof WpError ? e.message : String(e)] };
      return;
    }
    const strong = valid(imp(p, wp), prog.params);
    const weakest = valid(imp(wp, p), prog.params);
    const show = (c?: [string, string][]) => (c ?? []).map(([k, v]) => `${k} = ${v}`).join(', ');
    const lines: string[] = [];
    lines.push(strong.valid ? '✓ Strong enough: every input satisfying it makes the postcondition hold.' : `✗ Not strong enough: ${show(strong.counterexample)} satisfies your precondition, but the postcondition fails.`);
    lines.push(weakest.valid ? '✓ The weakest: every input for which the postcondition holds satisfies it.' : `✗ Stronger than necessary: for ${show(weakest.counterexample)} the postcondition holds, but your precondition rules it out.`);
    out = { ok: strong.valid && weakest.valid, lines };
    if (out.ok) progress.markSolved(id);
  }
</script>

<ExerciseFrame {id} kind="weakest precondition" {title} {prompt} {hints}>
  <pre class="code"><code>{code.replace(/\n$/, '')}</code></pre>
  <div class="row ui">
    <label for="{id}-pre"><code>requires</code></label>
    <input id="{id}-pre" bind:value={text} spellcheck="false" autocomplete="off" placeholder="a condition on the parameters" onkeydown={(e) => e.key === 'Enter' && check()} />
    <button type="button" class="go" onclick={check}>Check</button>
  </div>
  {#if out}
    <ul class="out ui" class:ok={out.ok}>{#each out.lines as l, i (i)}<li class:bad={l.startsWith('✗')}>{l}</li>{/each}</ul>
    {#if out.ok}<p class="ui wp">The calculator's answer, unsimplified: <code>{showFormula(wp)}</code></p>{/if}
  {/if}
</ExerciseFrame>

<style>
  .code {
    margin: 0.4rem 0;
    padding: 0.5rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: var(--panel);
    font-size: 0.8rem;
    overflow-x: auto;
  }
  .row {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;
  }
  input {
    flex: 1;
    min-width: 10rem;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    padding: 0.25rem 0.45rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  button {
    font-family: var(--font-ui);
    font-size: 0.85rem;
    padding: 0.25rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ink-blue);
    background: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
    cursor: pointer;
  }
  .out {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
  }
  .out li {
    margin: 0.2rem 0;
    color: var(--seal);
  }
  .out li.bad {
    color: var(--pencil);
  }
  .wp {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .wp code {
    overflow-wrap: anywhere;
  }
  .code code {
    all: unset;
    font-family: var(--font-mono);
    white-space: pre;
  }
</style>
