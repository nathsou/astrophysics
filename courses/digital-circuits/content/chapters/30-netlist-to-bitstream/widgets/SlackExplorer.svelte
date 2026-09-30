<!--
  Static timing analysis on a graph you can see whole: two flip-flops, four LUTs, two flip-flops. Change the delay of
  a net and watch the critical path move; change the target clock period and watch the slack go negative. The
  analysis is the course's own (`analyse` in sta.ts).

    ::slack-explorer{n="30.5" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { BOX, BOXES, NETS, defaultDelays, timing } from './slack';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let delays = $state(defaultDelays());
  let target = $state(5);
  let picked = $state(4);

  const t = $derived(timing(delays, target));
  const sel = $derived(NETS[picked]!);
  const path = $derived(t.result.path.filter((p) => p.kind !== 'net').map((p) => p.name.replace(' LUT', '')).join(' → '));
  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.max(12, (x2 - x1) * 0.5);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };
  const mid = (i: number) => {
    const e = NETS[i]!;
    return { x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2 - 4 };
  };
  const netState = (i: number) => (t.slack[i]! < -1e-9 ? 'bad' : t.onCritical[i] ? 'crit' : t.slackWorst[i]! < 0.5 ? 'near' : 'ok');
  const reset = () => {
    delays = defaultDelays();
    target = 5;
    picked = 4;
  };
  const summary = $derived(`The slowest path takes ${t.period.toFixed(1)} nanoseconds, so the fastest clock is ${t.fmax.toFixed(0)} megahertz. At a target of ${target.toFixed(1)} nanoseconds timing is ${t.met ? 'met' : 'not met'}.`);
</script>

<Widget {n} title="Slack" subtitle="Static timing analysis on a small design" {caption} onreset={reset}>
  <div class="se">
    <div class="scroll">
      <svg viewBox="-4 4 520 130" role="group" aria-label={summary} style:min-width="460px">
        {#each NETS as e, i (e.id)}
          <g
            class="net {netState(i)}"
            class:sel={picked === i}
            role="button"
            tabindex="0"
            aria-label="Net {e.id} from {e.from} to {e.to}, {delays[i]!.toFixed(1)} nanoseconds, slack {t.slack[i]!.toFixed(1)}"
            aria-pressed={picked === i}
            onclick={() => (picked = i)}
            onkeydown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                picked = i;
              }
            }}
          >
            <path d={curve(e.x1, e.y1, e.x2, e.y2)} class="hit" />
            <path d={curve(e.x1, e.y1, e.x2, e.y2)} class="wire" />
            <text x={mid(i).x} y={mid(i).y} text-anchor="middle" class="d">{e.id} {delays[i]!.toFixed(1)}</text>
          </g>
        {/each}
        {#each BOXES as b (b.id)}
          <g class="box {b.kind}">
            <rect x={b.x} y={b.y} width={BOX.w} height={BOX.h} rx="4" />
            <text x={b.x + BOX.w / 2} y={b.y + BOX.h / 2 + 3.5} text-anchor="middle">{b.label}</text>
            {#if b.kind === 'lut'}<text x={b.x + BOX.w / 2} y={b.y + BOX.h + 9} text-anchor="middle" class="cd">0.5</text>{/if}
          </g>
        {/each}
      </svg>
    </div>

    <div class="pick ui">
      <div class="nets" role="group" aria-label="Choose a net">
        {#each NETS as e, i (e.id)}
          <button type="button" class:on={picked === i} class:crit={t.onCritical[i]} onclick={() => (picked = i)} aria-pressed={picked === i}>{e.id}</button>
        {/each}
      </div>
      <Slider label="Delay of {sel.id}, {sel.from} → {sel.to} (ns)" bind:value={delays[picked]!} min={0.1} max={2.5} step={0.1} format={(v) => v.toFixed(1)} compact />
      <Slider label="Target clock period (ns)" bind:value={target} min={2} max={7} step={0.1} format={(v) => v.toFixed(1)} compact />
    </div>

    <div class="read ui" role="status">
      <div class="big"><span>slowest path</span><b>{t.period.toFixed(1)}</b><em>ns</em></div>
      <div class="big"><span>fmax</span><b>{t.fmax.toFixed(0)}</b><em>MHz</em></div>
      <div class="big" class:bad={!t.met}><span>at {target.toFixed(1)} ns</span><b>{t.met ? 'met' : 'failed'}</b><em>worst slack {(target - t.period).toFixed(1)}</em></div>
    </div>
    <p class="crit-path ui">Critical path: <b>{path}</b>. Net {sel.id} has <b class:neg={t.slack[picked]! < -1e-9}>{t.slack[picked]!.toFixed(1)} ns</b> of slack at this target; {t.onCritical[picked] ? 'it is on the critical path' : `it is ${t.slackWorst[picked]!.toFixed(1)} ns short of critical`}.</p>
  </div>
</Widget>

<style>
  .se {
    display: grid;
    gap: 0.6rem;
    padding: 0.8rem 1rem 1rem;
  }
  .scroll {
    overflow-x: auto;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .box rect {
    fill: var(--pn);
    stroke: var(--line-strong);
    stroke-width: 1.2;
  }
  .box.lut rect {
    fill: var(--panel);
  }
  .box text {
    font: 600 9px var(--font-mono);
    fill: var(--fg);
  }
  .box .cd {
    font-size: 6.5px;
    font-weight: 400;
    fill: var(--mute);
  }
  .net {
    cursor: pointer;
    outline: none;
  }
  .net .hit {
    fill: none;
    stroke: transparent;
    stroke-width: 12;
  }
  .net .wire {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }
  .net.near .wire {
    stroke: var(--sig-high);
    stroke-width: 1.8;
  }
  .net.crit .wire {
    stroke: var(--copper);
    stroke-width: 3;
  }
  .net.bad .wire {
    stroke: var(--bad);
    stroke-width: 3;
  }
  .net.sel .wire,
  .net:focus-visible .wire {
    stroke-dasharray: none;
    filter: drop-shadow(0 0 3px var(--copper));
  }
  .net .d {
    font: 500 7px var(--font-mono);
    fill: var(--mute);
  }
  .net.crit .d,
  .net.bad .d,
  .net.sel .d {
    fill: var(--fg);
    font-weight: 700;
  }
  .pick {
    display: grid;
    gap: 0.5rem;
  }
  .nets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .nets button {
    font: 600 0.72rem var(--font-mono);
    padding: 0.2rem 0.5rem;
    border-radius: 5px;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--ink-2);
    cursor: pointer;
    min-height: 1.9rem;
  }
  .nets button.crit {
    border-color: var(--copper);
  }
  .nets button.on {
    background: var(--copper-soft);
    color: var(--fg);
    border-color: var(--copper);
  }
  .read {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.6rem;
  }
  .big {
    display: grid;
    line-height: 1.15;
  }
  .big span {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  .big b {
    font: 600 1.35rem var(--font-mono);
    color: var(--fg);
  }
  .big em {
    font-style: normal;
    font-size: 0.74rem;
    color: var(--mute);
  }
  .big.bad b {
    color: var(--bad);
  }
  .crit-path {
    margin: 0;
    font-size: 0.84rem;
    color: var(--ink-2);
  }
  .crit-path b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .crit-path b.neg {
    color: var(--bad);
  }
</style>
