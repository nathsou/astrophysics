<!--
  The placement and routing traces of a design, replayed on the chip view: the annealer's blocks sliding into place
  as the temperature falls, then the router's congestion melting away.

    ::place-route-replay{design="alu"}
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { base } from '$app/paths';
  import Widget from '../../components/ui/Widget.svelte';
  import '../studio.css';
  import FpgaChip from '../chips/vfpga/FpgaChip.svelte';
  import { FpgaSession, type SizeChoice } from '../fpga/session.svelte';
  import { fpgaExample } from '../fpga/examples';
  import ReplayBar from '../panes/fpga/ReplayBar.svelte';

  let { design = 'alu', size = 'auto', mode = 'place', title, caption, n }: { design?: string; size?: string; mode?: string; title?: string; caption?: string; n?: string | number } = $props();

  const choice = untrack(() => (['S', 'M', 'L'].includes(size.toUpperCase()) ? (size.toUpperCase() as SizeChoice) : 'auto'));
  const session = new FpgaSession({ example: untrack(() => design), size: choice });
  let kind = $state<'place' | 'route'>(untrack(() => (mode === 'route' ? 'route' : 'place')));
  const name = $derived(fpgaExample(session.exampleId)?.title ?? design);

  onMount(() => {
    void session.fit().then(() => {
      session.replay.setMode(kind);
      session.replay.pos = 0;
    });
    return () => session.destroy();
  });
  function set(k: 'place' | 'route') {
    kind = k;
    session.replay.setMode(k);
    session.replay.pos = 0;
  }
</script>

<Widget title={title ?? `Place and route: ${name}`} kind="Toolchain replay" {caption} {n} wide fullscreen>
  {#snippet actions()}
    <a class="w-action" href="{base}/studio/{session.hash()}">Open in the Studio</a>
  {/snippet}
  <div class="studio compact">
    <div class="prr">
      <div class="tabs2 ui" role="tablist" aria-label="Replay">
        <button type="button" role="tab" aria-selected={kind === 'place'} class:on={kind === 'place'} onclick={() => set('place')}>Placement</button>
        <button type="button" role="tab" aria-selected={kind === 'route'} class:on={kind === 'route'} onclick={() => set('route')}>Routing</button>
        <span class="grow"></span>
        {#if session.status === 'running'}<span class="st">fitting {Math.round(session.progress * 100)} %</span>{:else if session.error}<span class="st bad">{session.error.message}</span>{:else if session.result}<span class="st">{session.result.deviceName} · {session.result.report.utilisation.cells.used} cells</span>{/if}
      </div>
      <div class="chipbox"><FpgaChip {session} view={kind} compact /></div>
      <ReplayBar {session} {kind} />
    </div>
  </div>
</Widget>

<style>
  .prr {
    display: flex;
    flex-direction: column;
    background: var(--panel);
  }
  .chipbox {
    height: 26rem;
  }
  .tabs2 {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0.3rem 0.5rem;
    background: var(--pn);
    border-bottom: 1px solid var(--line);
  }
  .tabs2 button {
    border: 0;
    background: transparent;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
    color: var(--mute);
    cursor: pointer;
    padding: 0.15rem 0.6rem;
    border-radius: 4px;
  }
  .tabs2 button.on {
    color: var(--copper-ink);
    background: var(--panel);
    box-shadow: 0 0 0 1px var(--line);
  }
  .grow {
    flex: 1;
  }
  .st {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--mute);
  }
  .st.bad {
    color: var(--bad);
  }
</style>
