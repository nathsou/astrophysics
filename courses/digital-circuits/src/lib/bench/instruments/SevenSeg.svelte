<!--
  A row of seven-segment digits on a dark screen: digits, minus, and the letters of "OL" (overload). Lit
  segments glow phosphor green; unlit ones stay faintly visible, like a real LCD/LED display.
-->
<script lang="ts">
  import { HEX_SEGMENTS, segmentPaths } from '../symbols/sevenseg';

  let { text, cells = 6, height = 64, tone = 'phosphor' }: { text: string; cells?: number; height?: number; tone?: 'phosphor' | 'amber' | 'red' } = $props();

  const EXTRA: Record<string, number> = { '-': 0x40, O: 0x3f, L: 0x38, r: 0x50, E: 0x79, ' ': 0 };
  const CW = 38;
  const CH = 64;
  const T = 7;
  const PATHS = segmentPaths(4, 4, CW - 12, CH - 8, T);

  const glyphs = $derived.by(() => {
    const out: { mask: number; dp: boolean }[] = [];
    for (const ch of text) {
      if (ch === '.') {
        const last = out[out.length - 1];
        if (last) last.dp = true;
        else out.push({ mask: 0, dp: true });
        continue;
      }
      const d = ch >= '0' && ch <= '9' ? HEX_SEGMENTS[Number(ch)]! : (EXTRA[ch] ?? 0);
      out.push({ mask: d, dp: false });
    }
    while (out.length < cells) out.unshift({ mask: 0, dp: false });
    return out.slice(-cells);
  });
  const width = $derived(cells * CW);
</script>

<svg class="seg {tone}" viewBox="0 0 {width} {CH}" height={height} width={(height * width) / CH} role="img" aria-label={text}>
  {#each glyphs as g, i (i)}
    <g transform="translate({i * CW} 0) skewX(-4)">
      {#each PATHS as d, s (s)}
        <path {d} class="s" class:on={!!(g.mask & (1 << s))} />
      {/each}
      <circle cx={CW - 5} cy={CH - 8} r="3.3" class="s" class:on={g.dp} />
    </g>
  {/each}
</svg>

<style>
  .seg {
    display: block;
    max-width: 100%;
    --lit: var(--phosphor);
    --glow: var(--phosphor-glow);
  }
  .seg.amber {
    --lit: var(--sig-high);
    --glow: var(--sig-high-glow);
  }
  .seg.red {
    --lit: var(--sig-x);
    --glow: color-mix(in srgb, var(--sig-x) 45%, transparent);
  }
  .s {
    fill: var(--lit);
    opacity: 0.09;
  }
  .s.on {
    opacity: 1;
    filter: drop-shadow(0 0 3px var(--glow));
  }
</style>
