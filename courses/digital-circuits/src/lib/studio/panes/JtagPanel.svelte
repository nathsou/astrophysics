<!--
  The JTAG panel: the TAP controller stepping through the real programming sequence of the fitted design,
  recorded on the JtagHost with a trace per TCK. Play, pause, step; TMS, TDI and TDO as lanes; the caption
  names the phase (ERASE, PROGRAM row 12, VERIFY…).
-->
<script lang="ts">
  import './../chips/chip.css';
  import { onMount } from 'svelte';
  import type { Studio } from '../studio.svelte';
  import { programOverJtag, type JtagSession } from '../jtag-model';
  import TapDiagram from '../chips/TapDiagram.svelte';
  import type { CpldChip } from '../adapters/cpld';
  import Icon from '../../components/ui/Icon.svelte';
  import type { TapState } from '../../pld/cpld/jtag';
  import { usercodeText } from '../../pld/devices/vcpld32-arch';

  let { studio, bitsOverride, compactDiagram = false }: { studio?: Studio; bitsOverride?: Uint8Array; compactDiagram?: boolean } = $props();

  const bits = $derived(bitsOverride ?? (studio?.fit?.chip as CpldChip | undefined)?.bits);
  let session = $state.raw<JtagSession | null>(null);
  let pos = $state(0);
  let playing = $state(false);
  let speedIdx = $state(2);
  const SPEEDS = [1, 4, 12, 40, 150, 600, 2500];
  const speed = $derived(SPEEDS[speedIdx]!);

  $effect(() => {
    const b = bits;
    session = b ? programOverJtag(b) : null;
    pos = 0;
    playing = false;
  });

  const total = $derived(session?.cycles.length ?? 0);
  const idx = $derived(Math.min(Math.floor(pos), Math.max(0, total - 1)));
  const cur = $derived(session?.cycles[idx]);
  const shown = $derived(cur ? cur.next : 'Test-Logic-Reset');
  const mark = $derived(session?.markAt(idx));
  const progress = $derived(session?.progress(idx) ?? { done: 0, current: -1 });
  const done = $derived(total > 0 && pos >= total - 1);
  const trail = $derived.by(() => {
    const s = session;
    if (!s) return [];
    const out: TapState[] = [];
    for (let i = Math.max(0, idx - 12); i <= idx; i++) out.push(s.cycles[i]!.next);
    return out;
  });
  const last = $derived(cur ? { from: cur.state, tms: cur.tms } : null);

  onMount(() => {
    let raf = 0;
    let t0 = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = t0 ? Math.min(0.1, (t - t0) / 1000) : 0;
      t0 = t;
      if (playing && session) {
        pos = Math.min(total - 1, pos + speed * dt);
        if (pos >= total - 1) playing = false;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  const step = (n: number) => {
    playing = false;
    pos = Math.max(0, Math.min(total - 1, Math.floor(pos) + n));
  };
  function nextPhase() {
    const s = session;
    if (!s) return;
    playing = false;
    const i = s.markIndexAt(idx);
    const next = s.marks[Math.min(s.marks.length - 1, i + 1)];
    if (next) pos = Math.min(total - 1, next.cycle);
  }
  function prevPhase() {
    const s = session;
    if (!s) return;
    playing = false;
    const i = s.markIndexAt(idx);
    const m = s.marks[idx > (s.marks[i]?.cycle ?? 0) ? i : Math.max(0, i - 1)];
    pos = m?.cycle ?? 0;
  }

  // Lanes: the last WINDOW cycles.
  const WINDOW = 40;
  const laneData = $derived.by(() => {
    const s = session;
    if (!s) return null;
    const from = Math.max(0, idx - WINDOW + 1);
    return s.cycles.slice(from, idx + 1);
  });
  const LW = 300;
  const cw = LW / WINDOW;
  function lane(getter: (c: NonNullable<typeof cur>) => 0 | 1 | null, y0: number, tck = false): string {
    const data = laneData;
    if (!data) return '';
    const hi = y0;
    const lo = y0 + 14;
    let d = '';
    const off = WINDOW - data.length;
    data.forEach((c, i) => {
      const x = (off + i) * cw;
      if (tck) {
        d += `${i === 0 ? 'M' : 'L'}${x} ${lo}L${x} ${hi}L${x + cw / 2} ${hi}L${x + cw / 2} ${lo}L${x + cw} ${lo}`;
        return;
      }
      const v = getter(c);
      const y = v === null ? (hi + lo) / 2 : v ? hi : lo;
      d += i === 0 ? `M${x} ${y}` : `L${x} ${y}`;
      d += `L${x + cw} ${y}`;
    });
    return d;
  }
  const hex = (v: number, n = 8) => v.toString(16).toUpperCase().padStart(n, '0');
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<div class="jtag ui">
  {#if session}
    <div class="ctl" role="toolbar" aria-label="JTAG playback">
      <button type="button" onclick={prevPhase} title="Previous phase" aria-label="Previous phase">⏮</button>
      <button type="button" onclick={() => step(-1)} title="Back one TCK" aria-label="Back one clock">◀</button>
      <button type="button" class="play" onclick={() => (done && !playing ? ((pos = 0), (playing = true)) : (playing = !playing))} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
      <button type="button" onclick={() => step(1)} title="Forward one TCK" aria-label="Forward one clock">▶|</button>
      <button type="button" onclick={nextPhase} title="Next phase" aria-label="Next phase">⏭</button>
      <button type="button" onclick={() => ((pos = 0), (playing = false))} title="Rewind" aria-label="Rewind"><Icon name="reset" size={13} /></button>
      <label class="sp"><span>speed</span><input type="range" min="0" max={SPEEDS.length - 1} bind:value={speedIdx} aria-label="Speed" aria-valuetext="{speed} clocks per second" /><output>{speed}/s</output></label>
      <span class="pos">TCK {idx + 1}/{total}</span>
    </div>
    {#if reduced}<p class="note">Reduced motion is on: use the step buttons; playback is not started for you.</p>{/if}
    <div class="cap" aria-live="polite">
      <strong>{mark?.label ?? ''}</strong>
      <span class="ir">instruction <code>{cur?.instruction ?? 'IDCODE'}</code> · state <code>{shown}</code></span>
    </div>
    <div class="body">
      <div class="dia"><TapDiagram state={shown} {last} {trail} /></div>
      <div class="side">
        <div class="die screen lanes">
          <svg viewBox="0 0 {LW + 44} 118" width="100%" role="img" aria-label="TCK, TMS, TDI and TDO for the last {WINDOW} clocks">
            {#each [['TCK', 6], ['TMS', 34], ['TDI', 62], ['TDO', 90]] as [n, y] (n)}
              <text x="0" y={Number(y) + 11} class="lbl">{n}</text>
            {/each}
            <g transform="translate(40 0)">
              <path d={lane(() => 0, 6, true)} fill="none" stroke="var(--metal-dim)" stroke-width="1.3" />
              <path d={lane((c) => c.tms, 34)} fill="none" stroke="var(--sig-current)" stroke-width="1.8" />
              <path d={lane((c) => c.tdi, 62)} fill="none" stroke="var(--hot)" stroke-width="1.8" />
              <path d={lane((c) => c.tdo, 90)} fill="none" stroke="var(--phosphor)" stroke-width="1.8" stroke-dasharray={cur?.tdo === null ? '3 3' : undefined} />
              <rect x={LW - cw} y="0" width={cw} height="112" fill="color-mix(in srgb, var(--hot) 16%, transparent)" />
            </g>
          </svg>
          <p class="lbl now">TMS <b>{cur?.tms ?? 0}</b> · TDI <b>{cur?.tdi ?? 0}</b> · TDO <b>{cur?.tdo === null || cur === undefined ? 'Z' : cur.tdo}</b></p>
        </div>
        <div class="stats">
          <div class="meter" role="meter" aria-label="Rows programmed" aria-valuemin="0" aria-valuemax={session.rowsProgrammed} aria-valuenow={progress.done}><span style:width="{(100 * progress.done) / Math.max(1, session.rowsProgrammed)}%"></span></div>
          <p>Rows written <b>{progress.done}/{session.rowsProgrammed}</b>{#if progress.current >= 0} · shifting row <b>{progress.current}</b>{/if}</p>
          {#if done}
            <p class:ok={session.ok} class:bad={!session.ok}>{session.ok ? 'Verified: every row reads back as written.' : `${session.mismatches} rows differ after programming.`}</p>
            <p>IDCODE <code>{hex(session.idcode)}</code> · USERCODE <code>{hex(session.usercode)}</code>{usercodeText(session.usercode) ? ` “${usercodeText(session.usercode)}”` : ''}</p>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <p class="empty">Fit a design to program it over JTAG.</p>
  {/if}
</div>

<style>
  .jtag {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    height: 100%;
    overflow: auto;
    padding: 0.6rem 0.7rem 1rem;
    background: var(--panel);
    color: var(--ink-2);
    font-size: 0.78rem;
  }
  .ctl {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem;
  }
  .ctl button {
    min-width: 2rem;
    height: 1.9rem;
    padding: 0 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
    font: inherit;
    display: grid;
    place-items: center;
  }
  .ctl button:hover {
    border-color: var(--copper);
  }
  .ctl .play {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
    min-width: 2.6rem;
  }
  .sp {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-left: 0.4rem;
    color: var(--mute);
  }
  .sp input {
    width: 6rem;
    accent-color: var(--phosphor);
  }
  .sp output,
  .pos {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--fg);
    min-width: 3.4rem;
  }
  .pos {
    margin-left: auto;
  }
  .cap {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    background: var(--pn);
    border: 1px solid var(--line);
    min-height: 2.9rem;
  }
  .cap strong {
    color: var(--fg);
    font-size: 0.8rem;
  }
  .ir code,
  p code {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--copper-ink);
  }
  .body {
    display: grid;
    gap: 0.7rem;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  @container (min-width: 640px) {
    .body {
      grid-template-columns: minmax(0, 1.2fr) minmax(16rem, 1fr);
    }
  }
  .lanes {
    padding: 0.6rem 0.7rem;
  }
  .now {
    margin: 0.3rem 0 0;
  }
  .now b {
    color: var(--hot);
  }
  .meter {
    height: 0.5rem;
    border-radius: 99px;
    background: var(--surface-3);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--copper), var(--sig-high));
  }
  .stats p {
    margin: 0.35rem 0 0;
  }
  .ok {
    color: var(--ok);
  }
  .bad {
    color: var(--bad);
  }
  .note,
  .empty {
    margin: 0;
    color: var(--mute);
  }
</style>
