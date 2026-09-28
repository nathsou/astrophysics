<!--
  Moser's circle problem: n points on a circle, every pair joined by a chord. Into how many regions
  is the disc cut? 1, 2, 4, 8, 16, … and then 31. Regions are coloured by flood fill on a canvas;
  the count comes from 1 + C(n,2) + C(n,4), valid when no three chords meet at a point.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';

  let n = $state(4);
  let canvas: HTMLCanvasElement;
  const SIZE = 360;

  const binom = (a: number, k: number) => {
    if (k < 0 || k > a) return 0;
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (a - k + i)) / i;
    return Math.round(r);
  };
  const regions = (m: number) => 1 + binom(m, 2) + binom(m, 4);
  const seq = Array.from({ length: 10 }, (_, i) => ({ n: i + 1, r: regions(i + 1), guess: 2 ** i }));

  /** Slightly irregular angles so that no three chords are concurrent. */
  function points(m: number): [number, number][] {
    const R = SIZE / 2 - 12;
    return Array.from({ length: m }, (_, i) => {
      const jitter = Math.sin(i * 12.9898 + m * 78.233) * 0.35;
      const t = ((i + 0.5 + jitter) / m) * 2 * Math.PI - Math.PI / 2;
      return [SIZE / 2 + R * Math.cos(t), SIZE / 2 + R * Math.sin(t)];
    });
  }

  function draw() {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const dpr = 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const styles = getComputedStyle(canvas);
    const ink = styles.getPropertyValue('--byrne-ink').trim() || '#222';
    const R = SIZE / 2 - 12;
    // 1. Draw walls (circle + chords) in pure black on a transparent canvas, without anti-aliasing tricks.
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, R, 0, 2 * Math.PI);
    ctx.stroke();
    const pts = points(n);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        ctx.beginPath();
        ctx.moveTo(pts[i]![0], pts[i]![1]);
        ctx.lineTo(pts[j]![0], pts[j]![1]);
        ctx.stroke();
      }
    // 2. Flood-fill every enclosed region with a colour.
    const img = ctx.getImageData(0, 0, SIZE, SIZE);
    const d = img.data;
    const wall = (p: number) => d[p * 4 + 3]! > 40;
    const inside = (x: number, y: number) => (x - SIZE / 2) ** 2 + (y - SIZE / 2) ** 2 < (R - 1) ** 2;
    const palette = ['#d0312d', '#1f5aa6', '#e9a91b', '#2f7d5f', '#c9578a', '#6a4c93', '#d9761f', '#2a8496'];
    let k = 0;
    const seen = new Uint8Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const p = y * SIZE + x;
        if (seen[p] || wall(p) || !inside(x, y)) continue;
        const colour = palette[k++ % palette.length]!;
        const [r, g, b] = [1, 3, 5].map((o) => parseInt(colour.slice(o, o + 2), 16)) as [number, number, number];
        const stack = [p];
        seen[p] = 1;
        while (stack.length) {
          const q = stack.pop()!;
          d[q * 4] = r;
          d[q * 4 + 1] = g;
          d[q * 4 + 2] = b;
          d[q * 4 + 3] = 70;
          const qx = q % SIZE;
          const qy = (q - qx) / SIZE;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = qx + dx;
            const ny = qy + dy;
            if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
            const nq = ny * SIZE + nx;
            if (seen[nq] || wall(nq) || !inside(nx, ny)) continue;
            seen[nq] = 1;
            stack.push(nq);
          }
        }
      }
    // Recolour the walls in the ink colour.
    const [ir, ig, ib] = ink.startsWith('#') ? ([1, 3, 5].map((o) => parseInt(ink.slice(o, o + 2), 16)) as [number, number, number]) : [30, 30, 30];
    for (let p = 0; p < SIZE * SIZE; p++)
      if (wall(p) && !seen[p]) {
        d[p * 4] = ir;
        d[p * 4 + 1] = ig;
        d[p * 4 + 2] = ib;
      }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = ink;
    for (const [x, y] of pts) {
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  onMount(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const obs = new MutationObserver(() => draw());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    mq.addEventListener('change', draw);
    return () => {
      obs.disconnect();
      mq.removeEventListener('change', draw);
    };
  });
  $effect(() => {
    void n;
    if (canvas) draw();
  });
</script>

<Widget title="Points on a circle" subtitle="Join every pair of points with a chord and count the regions. Guess the next number before you move the slider." onreset={() => (n = 4)}>
  {#snippet controls()}
    <label class="ctl">Points: <strong class="num">{n}</strong>
      <input type="range" min="1" max="10" bind:value={n} aria-label="Number of points" />
    </label>
  {/snippet}
  <div class="layout">
    <canvas bind:this={canvas} width={SIZE} height={SIZE} style:width="{SIZE}px" style:max-width="100%" aria-label="{n} points on a circle joined by chords, cutting the disc into {regions(n)} regions"></canvas>
    <table class="num">
      <thead><tr><th>points</th><th>regions</th><th>doubling guess</th></tr></thead>
      <tbody>
        {#each seq as s (s.n)}
          <tr class:cur={s.n === n} class:hidden={s.n > n} class:broken={s.n <= n && s.r !== s.guess}>
            <td>{s.n}</td>
            <td><strong>{s.n <= n ? s.r : '?'}</strong></td>
            <td>{s.guess}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.85rem;
  }
  .layout {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    align-items: center;
    justify-content: center;
  }
  canvas {
    height: auto;
    aspect-ratio: 1;
  }
  table {
    width: auto;
    margin: 0;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  th,
  td {
    padding: 0.2rem 0.7rem;
    text-align: right;
    border-bottom: 1px solid var(--rule);
  }
  th {
    font-weight: 600;
    color: var(--ink-2);
  }
  tr.cur td {
    background: var(--accent-soft);
  }
  tr.hidden td {
    color: var(--ink-3);
  }
  tr.broken td:nth-child(2) {
    color: var(--bad);
  }
</style>
