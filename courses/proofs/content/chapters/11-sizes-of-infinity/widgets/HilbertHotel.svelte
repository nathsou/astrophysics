<!--
  Hilbert's hotel: infinitely many rooms, all occupied. Watch the guests move so that new guests
  fit — one more, a coachload of infinitely many, and infinitely many coaches.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  type Scene = 'one' | 'coach' | 'coaches';
  let scene = $state<Scene>('one');
  let moved = $state(false);
  const ROOMS = 16;

  const SCENES: Record<Scene, { label: string; rule: string; explain: string }> = {
    one: { label: 'One new guest', rule: 'guest in room n moves to room n + 1', explain: 'Room 1 becomes free for the newcomer.' },
    coach: { label: 'A coach with infinitely many guests', rule: 'guest in room n moves to room 2n', explain: 'All the odd rooms 1, 3, 5, … become free: one for each passenger.' },
    coaches: { label: 'Infinitely many coaches', rule: 'guest in room n moves to room 2ⁿ; passenger k of coach c goes to room pᶜᵏ (p the (c+1)th prime)', explain: 'Existing guests go to powers of 2; coach 1 to powers of 3, coach 2 to powers of 5, … By unique factorisation (Chapter 6) no two people share a room — and many rooms stay empty.' },
  };

  /** Where the guest now in room n goes (for the old guests). */
  const target = (n: number) => (scene === 'one' ? n + 1 : scene === 'coach' ? 2 * n : 2 ** n);
  const HUES = ['var(--byrne-blue)', 'var(--byrne-yellow)', 'var(--series-3)', 'var(--series-7)'];
  // Newcomers: which rooms they take (only those visible).
  const newcomers = $derived.by(() => {
    if (!moved) return [] as { room: number; hue: string; name: string }[];
    if (scene === 'one') return [{ room: 1, hue: 'var(--byrne-red)', name: 'new' }];
    if (scene === 'coach') return Array.from({ length: ROOMS / 2 }, (_, i) => ({ room: 2 * i + 1, hue: 'var(--byrne-red)', name: `c${i + 1}` }));
    const out: { room: number; hue: string; name: string }[] = [];
    [3, 5, 7, 11].forEach((p, c) => {
      for (let k = 1; p ** k <= ROOMS; k++) out.push({ room: p ** k, hue: HUES[c + 1] ?? 'var(--byrne-red)', name: `${c + 1}.${k}` });
    });
    return out;
  });
  const W = 640;
  const cellW = (W - 20) / ROOMS;
  const X = (room: number) => 10 + (room - 1) * cellW + cellW / 2;
</script>

<Widget title="Hilbert’s hotel" subtitle="Every room is taken. Make room anyway: every guest moves at the same moment, following one rule." onreset={() => (moved = false)}>
  {#snippet controls()}
    <div class="tabs">
      {#each Object.entries(SCENES) as [k, s] (k)}
        <button class:on={scene === k} onclick={() => ((scene = k as Scene), (moved = false))}>{s.label}</button>
      {/each}
    </div>
    <button class="go" onclick={() => (moved = !moved)}>{moved ? 'Reset' : 'Move everyone'}</button>
  {/snippet}
  <svg viewBox="0 0 {W} 150" width="100%" role="img" aria-label="Rooms 1 to {ROOMS} of an infinite hotel">
    {#each Array.from({ length: ROOMS }, (_, i) => i + 1) as r (r)}
      <rect x={10 + (r - 1) * cellW + 2} y="40" width={cellW - 4} height="70" rx="4" class="room" />
      <text x={X(r)} y="128" class="num-lab">{r}</text>
    {/each}
    <text x={W - 6} y="85" class="dots">…</text>
    {#each Array.from({ length: ROOMS }, (_, i) => i + 1) as n (n)}
      {@const t = moved ? target(n) : n}
      {#if t <= ROOMS + 1}
        <g class="guest" style:transform="translate({X(Math.min(t, ROOMS + 1))}px, 75px)" style:opacity={t > ROOMS ? 0 : 1}>
          <circle r={cellW / 2 - 6} />
          <text y="4">{n}</text>
        </g>
      {/if}
    {/each}
    {#each newcomers as g (g.name)}
      <g class="guest new" style:transform="translate({X(g.room)}px, 75px)" style:--h={g.hue}>
        <circle r={cellW / 2 - 6} />
        <text y="4">{g.name}</text>
      </g>
    {/each}
  </svg>
  <p class="rule"><strong>Rule:</strong> {SCENES[scene].rule}. {#if moved}{SCENES[scene].explain}{/if}</p>
</Widget>

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  button {
    font: inherit;
    font-size: 0.78rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }
  .tabs button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .go {
    border-color: var(--accent);
  }
  .room {
    fill: var(--surface-2);
    stroke: var(--rule-strong);
  }
  .num-lab {
    font-size: 11px;
    fill: var(--ink-3);
    text-anchor: middle;
    font-family: var(--font-ui);
  }
  .dots {
    font-size: 20px;
    fill: var(--ink-3);
    text-anchor: end;
  }
  .guest {
    transition: transform 1.2s cubic-bezier(0.6, 0, 0.3, 1), opacity 1.2s;
  }
  .guest circle {
    fill: var(--byrne-blue);
    stroke: var(--byrne-ink);
  }
  .guest.new circle {
    fill: var(--h);
  }
  .guest.new {
    animation: arrive 0.6s 1s ease-out both;
  }
  @keyframes arrive {
    from {
      opacity: 0;
    }
  }
  .guest text {
    font-size: 9px;
    font-weight: 700;
    fill: white;
    text-anchor: middle;
    font-family: var(--font-ui);
  }
  .rule {
    font-size: 0.85rem;
    margin: 0.3rem 0 0;
  }
</style>
