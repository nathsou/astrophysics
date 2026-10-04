<!--
  Liveness and fairness: check a system's temporal properties with and without its fairness declarations.
  Without fairness the scheduler may starve a process forever, and the checker shows that run as a lasso.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import VouchEditor from '$lib/components/verify/VouchEditor.svelte';
  import Badge from '$lib/components/verify/Badge.svelte';
  import TraceView from '$lib/components/verify/TraceView.svelte';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check } from '$lib/fv/vouch/check/checker';
  import { SystemRuntime } from '$lib/fv/vouch/interp/system';
  import { checkProperty } from '$lib/fv/ltl/check';
  import type { Verdict } from '$lib/fv/engines';

  let { code, title, caption }: { code: string; title?: string; caption?: string } = $props();

  let editor: VouchEditor | undefined = $state();
  let fair = $state(false);
  let verdicts = $state.raw<Verdict[]>([]);
  let error = $state('');
  let hasFairness = $state(false);

  function run(src: string, withFairness: boolean) {
    error = '';
    verdicts = [];
    const parsed = parse(src);
    const checked = check(parsed.program);
    const errs = [...parsed.diagnostics, ...checked.diagnostics].filter((d) => d.severity === 'error');
    if (errs.length) {
      error = errs[0]!.message;
      return;
    }
    const sys = [...checked.containers.values()].find((c) => c.kind === 'system');
    if (!sys) {
      error = 'There is no system here.';
      return;
    }
    hasFairness = sys.fairness.length > 0;
    try {
      const rt = new SystemRuntime(checked, sys.decl.name);
      verdicts = sys.properties.map((p) => checkProperty(rt, p, { fairness: withFairness, timeout: 8000 }));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  $effect(() => {
    const f = fair;
    const src = code;
    untrack(() => run(editor?.getValue() ?? src, f));
  });
</script>

<figure class="live">
  {#if title}<header class="ui"><span class="kicker">Liveness</span> <span class="title">{title}</span></header>{/if}
  <VouchEditor bind:this={editor} value={code} name="liveness" minLines={6} maxHeight="20rem" />
  <div class="bar ui">
    <label class="switch"><input type="checkbox" bind:checked={fair} disabled={!hasFairness} /> Apply the fairness declarations{#if !hasFairness} (this model has none){/if}</label>
    <button type="button" onclick={() => run(editor?.getValue() ?? code, fair)}>Check the edited model</button>
  </div>
  {#if error}<p class="err ui">{error}</p>{/if}
  {#each verdicts as v, i (i)}
    <Badge verdict={v} open={v.status === 'violated'} />
    {#if v.trace}<TraceView trace={v.trace} caption="The lasso: the prefix, then the cycle repeated forever" />{/if}
  {/each}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .live {
    margin: 2rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .kicker {
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gold);
    font-weight: 700;
  }
  .title {
    font-weight: 600;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .switch {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-weight: 600;
  }
  .switch input {
    accent-color: var(--seal);
    width: 1.1rem;
    height: 1.1rem;
  }
  button {
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
    padding: 0.28rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .err {
    color: var(--pencil);
  }
  figcaption {
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
