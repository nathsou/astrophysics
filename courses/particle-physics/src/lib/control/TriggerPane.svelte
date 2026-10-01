<!-- Stage 5 controls: the menu (threshold, prescale, on/off per item), whether the analysis sees only triggered events, the dead time, and the rates. -->
<script lang="ts">
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { MENU_KINDS, PRESCALES, SETTING_RANGES, hltThresholdFor, makeSetting, startSettings } from '$lib/hep/trigger/index.ts';
  import type { ControlSession } from './session.svelte.ts';
  import { hz, pct, sig } from './fmt.ts';
  import './control.css';

  let { session }: { session: ControlSession } = $props();
  const t = $derived(session.config.trigger);
  const s = $derived(session.summary);
  const label = (key: string) => MENU_KINDS.find((k) => k.key === key)?.label ?? key;
  const missing = $derived(MENU_KINDS.filter((k) => !t.menu.some((m) => m.key === k.key)));
  const rate = (key: string) => s?.trigger.items.find((i) => i.name === key);
  const setL1 = (i: number, v: number) => {
    const m = session.config.trigger.menu[i]!;
    m.l1Threshold = v;
    m.hltThreshold = hltThresholdFor(m.key, v);
  };
  const add = (key: string) => {
    const start = startSettings().find((x) => x.key === key);
    session.config.trigger.menu = [...session.config.trigger.menu, makeSetting(key, start?.l1Threshold ?? SETTING_RANGES[key]!.min)];
  };
</script>

{#each t.menu as m, i (m.key)}
  {@const r = SETTING_RANGES[m.key]}
  <div class="item" class:off={m.enabled === false}>
    <div class="head">
      <Toggle label={label(m.key)} checked={m.enabled !== false} onchange={(c) => (session.config.trigger.menu[i]!.enabled = c)} />
      {#if rate(m.key)}<span class="cr-mono rate" title="Rate after prescales at the HLT, for the events of this run">{hz(rate(m.key)!.hltRate)}</span>{/if}
    </div>
    {#if r}
      <Slider label="L1 threshold [GeV]" min={r.min} max={r.max} step={r.step} value={m.l1Threshold} format={(v) => String(Math.round(v * 10) / 10)} oninput={(v) => setL1(i, v)} compact />
    {/if}
    <label class="ps ui">Prescale
      <select class="cr-select" value={m.prescale} onchange={(e) => (session.config.trigger.menu[i]!.prescale = Number(e.currentTarget.value))}>
        {#each PRESCALES as p}<option value={p}>{p === 1 ? '1 (keep all)' : `1 in ${p}`}</option>{/each}
      </select>
    </label>
  </div>
{/each}
{#if missing.length}
  <label class="ps ui">Add an item
    <select class="cr-select" value="" onchange={(e) => { if (e.currentTarget.value) add(e.currentTarget.value); e.currentTarget.value = ''; }}>
      <option value="">choose…</option>
      {#each missing as k}<option value={k.key}>{k.label}</option>{/each}
    </select>
  </label>
{/if}
<Toggle label="Analysis sees only triggered events" checked={t.apply} onchange={(c) => (session.config.trigger.apply = c)} />
<Slider label="Dead time per accept [ns]" min={0} max={1000} step={10} value={t.deadTimeNs} format={(v) => `${Math.round(v)} ns`} oninput={(v) => (session.config.trigger.deadTimeNs = Math.round(v))} />
{#if s}
  <dl class="read ui">
    <div><dt>Level-1 rate</dt><dd>{hz(s.trigger.l1Total)}</dd></div>
    <div><dt>HLT rate</dt><dd>{hz(s.trigger.hltTotal)}</dd></div>
    <div><dt>live fraction</dt><dd>{pct(s.trigger.liveFraction, 2)}</dd></div>
    <div><dt>bandwidth</dt><dd>{sig(s.trigger.bandwidthMBs)} MB/s</dd></div>
  </dl>
  <p class="cr-note">These are the rates of the events in this run, σ L × efficiency, at {sig(s.trigger.lumi)} cm⁻² s⁻¹. They are not the rate of everything a detector sees: the minimum-bias and QCD events that dominate the real trigger are not in this run.</p>
{/if}

<style>
  .item {
    display: grid;
    gap: 0.25rem;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .item.off {
    opacity: 0.55;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .rate {
    font-size: 0.76rem;
    color: var(--phosphor-ink);
  }
  .ps {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .read {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 0.3rem 0.8rem;
    margin: 0;
    font-size: 0.8rem;
  }
  dt {
    color: var(--mute);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
  }
</style>
