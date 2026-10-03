<script lang="ts">
  /**
   * Say a syllable or word and see your pitch drawn over the target tone shapes. For a single
   * syllable the course also names the tone it heard. Everything runs on this device: the
   * recording never leaves the browser.
   */
  import { annotate } from '$lib/zh/annotate';
  import { analyse, targetContour, TONE_NAMES, type Analysis } from '$lib/audio/tones';
  import { Recorder, playRecording, type Recording } from '$lib/audio/recorder';
  import { learnVoice, loadVoice } from '$lib/audio/voice';
  import { settings } from '$lib/state/settings.svelte';
  import { sfx } from '$lib/audio/sfx';
  import Zh from './Zh.svelte';
  import PlayButton from './PlayButton.svelte';
  import Icon from '../ui/Icon.svelte';

  let { text, onresult }: { text: string; onresult?: (ok: boolean | null) => void } = $props();

  const syl = $derived(annotate(text).flatMap((t) => t.s ?? []));
  const single = $derived(syl.length === 1);
  let phase = $state<'idle' | 'recording' | 'done' | 'error'>('idle');
  let live = $state<number[]>([]);
  let level = $state(0);
  let result = $state<Analysis | null>(null);
  let rec = $state<Recording | null>(null);
  let error = $state('');
  let recorder: Recorder | null = null;
  let liveRef = 0;

  $effect(() => {
    void text;
    phase = 'idle';
    result = null;
    rec = null;
    live = [];
  });

  const W = 300;
  const H = 150;
  const y = (chao: number) => 10 + ((5 - chao) / 4) * (H - 20);

  /** Target bands: one segment per syllable; neutral tones are a short low mark. */
  const targets = $derived(
    syl.map((s, i) => {
      const x0 = (i / syl.length) * W + 8;
      const x1 = ((i + 1) / syl.length) * W - 8;
      if (s.tone === 5) return { tone: 5, d: `M${x0 + (x1 - x0) * 0.3},${y(2)} L${x0 + (x1 - x0) * 0.6},${y(1.8)}` };
      const pts = targetContour(s.tone as 1 | 2 | 3 | 4, 16);
      return { tone: s.tone, d: pts.map((v, k) => `${k ? 'L' : 'M'}${(x0 + (k / 15) * (x1 - x0)).toFixed(1)},${y(v).toFixed(1)}`).join(' ') };
    }),
  );

  const yours = $derived.by(() => {
    const pts = result?.chao.length ? result.chao : live;
    if (pts.length < 2) return '';
    return pts.map((v, k) => `${k ? 'L' : 'M'}${(8 + (k / (pts.length - 1)) * (W - 16)).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  });

  async function record() {
    if (phase === 'recording') {
      recorder?.stop();
      return;
    }
    error = '';
    result = null;
    live = [];
    const voice = loadVoice();
    const ref = voice?.mid;
    recorder = new Recorder((hz, lv) => {
      level = lv;
      if (hz && ref) {
        const chao = Math.max(0.6, Math.min(5.4, 3 + (12 * Math.log2(hz / ref)) / 2.5));
        live = [...live.slice(-80), chao];
      } else if (hz) {
        live = [...live.slice(-80), 3];
      }
      cancelAnimationFrame(liveRef);
    });
    phase = 'recording';
    try {
      const r = await recorder.start();
      rec = r;
      const voiced = r.pitch.filter((x): x is number => !!x).sort((a, b) => a - b);
      const a = analyse(r.pitch, 0.01, loadVoice());
      if (voiced.length > 10) learnVoice(voiced[Math.floor(voiced.length / 2)]!);
      result = a;
      phase = 'done';
      if (single && a.tone) {
        const ok = a.tone === syl[0]!.tone || (syl[0]!.tone === 5 && a.tone !== null);
        sfx(ok ? 'right' : 'wrong', settings.data.sounds);
        onresult?.(ok);
      } else onresult?.(null);
    } catch (e) {
      phase = 'error';
      error = e instanceof DOMException && e.name === 'NotAllowedError' ? 'Microphone access was blocked. Allow it in your browser to use the tone mirror.' : 'No microphone available.';
    }
  }

  const verdict = $derived.by(() => {
    if (!result || !single) return null;
    if (!result.tone) return { ok: null, text: result.reason };
    const want = syl[0]!.tone;
    if (want === 5) return { ok: true, text: 'Neutral tones are short and light; yours sounds fine.' };
    if (result.tone === want) return { ok: true, text: `${result.reason} Exactly what we wanted.` };
    return { ok: false, text: `I heard a ${TONE_NAMES[result.tone]}. The target is the ${TONE_NAMES[want]}.` };
  });
</script>

<div class="mirror">
  <div class="top">
    <Zh text={text} size="lg" play={false} />
    <PlayButton {text} />
    <PlayButton {text} slow />
  </div>
  <svg viewBox="0 0 {W} {H}" class="plot" role="img" aria-label="Pitch plot: target tone shapes{yours ? ' and your pitch' : ''}">
    {#each [1, 2, 3, 4, 5] as l (l)}
      <line x1="0" x2={W} y1={y(l)} y2={y(l)} class="grid" />
      <text x="2" y={y(l) - 2} class="lvl">{l}</text>
    {/each}
    {#each targets as t, i (i)}
      <path d={t.d} class="target t{t.tone}" />
    {/each}
    {#if yours}<path d={yours} class="you" class:live={phase === 'recording'} />{/if}
  </svg>
  <div class="controls ui">
    <button class="rec" class:on={phase === 'recording'} onclick={record} style="--lv: {Math.min(1, level * 12)}">
      <Icon name={phase === 'recording' ? 'stop' : 'mic'} size={18} />
      {phase === 'recording' ? 'Listening…' : phase === 'done' ? 'Try again' : 'Record'}
    </button>
    {#if rec && phase === 'done'}<button class="btn small ghost" onclick={() => rec && playRecording(rec)}><Icon name="play" size={13} />Hear yourself</button>{/if}
    <span class="legend"><i class="sw target-sw"></i>target <i class="sw you-sw"></i>you</span>
  </div>
  {#if error}<p class="msg bad">{error}</p>{/if}
  {#if verdict}
    <p class="msg" class:good={verdict.ok === true} class:bad={verdict.ok === false}>{verdict.text}</p>
  {:else if result && !single}
    <p class="msg">Compare your line with the coloured shapes. Each syllable gets its own slot; aim to match the direction of each one.</p>
  {/if}
</div>

<style>
  .mirror {
    display: grid;
    gap: 0.6rem;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .plot {
    width: 100%;
    max-width: 30rem;
    background: var(--pn);
    border-radius: 12px;
  }
  .grid {
    stroke: var(--line-strong);
    stroke-width: 0.5;
    stroke-dasharray: 3 3;
  }
  .lvl {
    font: 600 8px var(--font-ui);
    fill: var(--mute);
  }
  .target {
    fill: none;
    stroke: var(--tone);
    stroke-width: 12;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.28;
  }
  .you {
    fill: none;
    stroke: var(--fg);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .you.live {
    stroke-dasharray: 4 3;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }
  .rec {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.55rem 1.1rem;
    border-radius: 999px;
    border: none;
    background: var(--accent);
    color: #fff;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 0 0 calc(var(--lv) * 10px) color-mix(in srgb, var(--accent) 25%, transparent);
    transition: box-shadow 80ms;
  }
  .legend {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: var(--mute);
    margin-left: auto;
  }
  .sw {
    display: inline-block;
    width: 1.1rem;
    height: 0.35rem;
    border-radius: 99px;
  }
  .target-sw {
    background: color-mix(in srgb, var(--t3) 35%, transparent);
  }
  .you-sw {
    background: var(--fg);
    height: 0.18rem;
    margin-left: 0.4rem;
  }
  .msg {
    margin: 0;
    font-size: 0.95rem;
  }
  .good {
    color: var(--jade);
  }
  .bad {
    color: var(--accent-ink);
  }
</style>
