<script lang="ts" module>
  import { base } from '$app/paths';
  /** Load stroke data from this site (static/strokes), not a CDN. */
  export function loadChar(ch: string, onLoad: (d: unknown) => void, onError: (e: unknown) => void): void {
    fetch(`${base}/strokes/${encodeURIComponent(ch)}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`No stroke data for ${ch}`))))
      .then(onLoad, onError);
  }
</script>

<script lang="ts">
  /**
   * One character on a practice grid (米字格), driven by hanzi-writer: animate the stroke order,
   * or quiz the learner stroke by stroke.
   */
  import { onMount } from 'svelte';
  import type HanziWriterType from 'hanzi-writer';

  let {
    char,
    size = 220,
    mode = 'show',
    outline = true,
    oncomplete,
    onstroke,
    writer = $bindable(),
  }: {
    char: string;
    size?: number;
    mode?: 'show' | 'quiz';
    outline?: boolean;
    oncomplete?: (mistakes: number) => void;
    onstroke?: (ok: boolean, strokeNum: number) => void;
    writer?: HanziWriterType;
  } = $props();

  let host: HTMLDivElement;
  let failed = $state(false);

  const colour = (name: string) => getComputedStyle(host).getPropertyValue(name).trim() || '#333';

  onMount(() => {
    let alive = true;
    void import('hanzi-writer').then(({ default: HanziWriter }) => {
      if (!alive) return;
      host.innerHTML = '';
      const w = HanziWriter.create(host, char, {
        width: size,
        height: size,
        padding: 12,
        showOutline: outline,
        showCharacter: mode === 'show',
        strokeAnimationSpeed: 1.1,
        delayBetweenStrokes: 180,
        strokeColor: colour('--fg'),
        outlineColor: colour('--line-strong'),
        radicalColor: colour('--accent'),
        highlightColor: colour('--t3'),
        drawingColor: colour('--fg'),
        drawingWidth: 18,
        charDataLoader: loadChar as never,
        onLoadCharDataError: () => (failed = true),
      });
      writer = w;
      if (mode === 'quiz') {
        void w.quiz({
          showHintAfterMisses: 3,
          leniency: 1.2,
          onMistake: (d) => onstroke?.(false, d.strokeNum),
          onCorrectStroke: (d) => onstroke?.(true, d.strokeNum),
          onComplete: (s) => oncomplete?.(s.totalMistakes),
        });
      }
    });
    return () => {
      alive = false;
    };
  });
</script>

<div class="grid" style="--s: {size}px" aria-label="Character {char}">
  <svg class="guides" viewBox="0 0 100 100" aria-hidden="true">
    <rect x="0.5" y="0.5" width="99" height="99" />
    <path d="M0 50h100M50 0v100M0 0l100 100M100 0 0 100" />
  </svg>
  <div class="writer" bind:this={host}></div>
  {#if failed}<p class="err ui">No stroke data for {char}.</p>{/if}
</div>

<style>
  .grid {
    position: relative;
    width: var(--s);
    height: var(--s);
    background: var(--panel);
    border-radius: 6px;
    touch-action: none;
  }
  .guides {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .guides rect {
    fill: none;
    stroke: var(--accent);
    stroke-width: 1;
    opacity: 0.6;
  }
  .guides path {
    stroke: var(--accent);
    stroke-width: 0.5;
    stroke-dasharray: 2 2;
    opacity: 0.35;
  }
  .writer {
    position: relative;
  }
  .err {
    position: absolute;
    inset: auto 0 0.4rem;
    text-align: center;
    font-size: 0.8rem;
    color: var(--mute);
  }
</style>
