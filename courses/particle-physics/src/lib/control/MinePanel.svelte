<!-- "My code": the reader's saved solutions, with the hook each feeds, its exercise, an on/off switch, and what happened when it was installed. -->
<script lang="ts">
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { base } from '$app/paths';
  import { STAGE_TITLES } from '$lib/hep/pipeline/index.ts';
  import type { ControlSession } from './session.svelte.ts';
  import './control.css';

  let { session }: { session: ControlSession } = $props();
  const active = $derived(new Set(session.snap?.mine?.active ?? []));
  const errors = $derived(session.snap?.mine?.errors ?? {});
</script>

<div class="mine ui">
  {#if session.mine.length === 0}
    <p class="cr-note">
      You have not saved any solution yet. When a code exercise in a chapter passes its tests, its code is saved here, and "use my code" switches it on for the stage it belongs to.
      Until then, every stage runs the library's reference implementation.
    </p>
  {:else}
    <div class="cr-scroll">
      <table class="cr-table">
        <caption class="cr-visually-hidden">Saved solutions</caption>
        <thead><tr><th scope="col">Hook</th><th scope="col">Stage</th><th scope="col">Exercise</th><th scope="col">Use my code</th><th scope="col">Status</th></tr></thead>
        <tbody>
          {#each session.mine as m (m.hook)}
            <tr>
              <th scope="row" class="cr-mono">{m.hook}</th>
              <td>{m.stage ? STAGE_TITLES[m.stage] : 'not used by the pipeline'}</td>
              <td>{m.exercise}</td>
              <td><Toggle label="" checked={m.enabled} onchange={(c) => session.toggleMine(m.hook, c)} /><span class="cr-visually-hidden">{m.hook}</span></td>
              <td>
                {#if !m.enabled}<span class="cr-badge">off: reference runs</span>
                {:else if errors[m.hook]}<span class="cr-badge bad" title={errors[m.hook]}>error</span> <span class="err">{errors[m.hook]}</span>
                {:else if active.has(m.hook)}<span class="cr-badge mine">installed in the workers</span>
                {:else}<span class="cr-badge">waiting for workers</span>{/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="cr-note">Switching a solution on or off restarts the run, because the events already made were made with the other code. Solutions are saved in this browser when an exercise passes (see the chapter's exercise).</p>
  {/if}
  <p class="cr-note">The panes above are labelled <span class="cr-badge">reference</span> or <span class="cr-badge mine">mine</span> by the hooks that are installed in the workers. See <a class="cr-link" href="{base}/appendix/">the appendices</a> for the hook names.</p>
</div>

<style>
  .err {
    font-size: 0.74rem;
    color: var(--bad);
  }
  td,
  th {
    vertical-align: middle;
  }
  td:nth-child(n + 2) {
    text-align: left;
  }
</style>
