<!-- Start, stop and reset, the number of events, the seed, the preset, and the shareable link. -->
<script lang="ts">
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { PRESET_NAMES, PRESET_INFO } from '$lib/hep/pipeline/index.ts';
  import type { ControlSession } from './session.svelte.ts';
  import { int } from './fmt.ts';
  import './control.css';

  let { session }: { session: ControlSession } = $props();
  const snap = $derived(session.snap);
  let copied = $state('');
  async function copy() {
    const url = await session.link();
    try {
      await navigator.clipboard.writeText(url);
      copied = 'Link copied';
    } catch {
      copied = url;
    }
    setTimeout(() => (copied = ''), 4000);
  }
  const targets = [0, 1000, 10000, 100000];
  const problems = $derived(snap?.problems ?? []);
</script>

<div class="bar ui">
  <div class="main">
    {#if session.running}
      <button type="button" class="cr-btn stop" onclick={() => session.stop()}>Stop</button>
    {:else}
      <button type="button" class="cr-btn primary" onclick={() => session.start()}>{snap && snap.events > 0 && !snap.finished ? 'Continue' : 'Start'}</button>
    {/if}
    <button type="button" class="cr-btn" onclick={() => session.reset()} disabled={!snap || (snap.events === 0 && !snap.running)}>Reset</button>
    <label class="f">Events
      <select class="cr-select" value={session.target} onchange={(e) => (session.target = Number(e.currentTarget.value))}>
        {#each targets as t}<option value={t}>{t === 0 ? 'until stopped' : int(t)}</option>{/each}
      </select>
    </label>
    <label class="f">Seed
      <input class="cr-input num" type="number" step="1" value={session.seed} onchange={(e) => { const v = Math.trunc(Number(e.currentTarget.value)); if (Number.isFinite(v)) { session.seed = v; session.reset(); } }} />
    </label>
    <button type="button" class="cr-btn" onclick={copy}>Copy link</button>
    <span class="copied" role="status">{copied}</span>
  </div>
  <div class="presets">
    <span class="cr-label">Preset</span>
    <div class="scroll"><Segmented label="Preset" size="sm" options={PRESET_NAMES.map((p) => ({ value: p, label: PRESET_INFO[p].title, title: PRESET_INFO[p].summary }))} value={session.config.name} onchange={(v) => session.setPreset(v as string)} /></div>
  </div>
</div>
{#each problems as p}<p class="cr-warn ui" role="alert">{p}</p>{/each}

<style>
  .bar {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .main {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.8rem;
    align-items: center;
  }
  .f {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .copied {
    font-size: 0.78rem;
    color: var(--ok);
    max-width: 22rem;
    overflow-wrap: anywhere;
  }
  .presets .scroll {
    overflow-x: auto;
    max-width: 100%;
    padding-bottom: 0.2rem;
  }
</style>
