<!--
  Pinouts of the chips in the Build it for real labs, drawn as DIP packages from data (pinouts.ts). Pins are
  coloured by role, and every pin has its name and number as text, so colour is never the only cue.

    ::pinout-gallery{}
-->
<script lang="ts">
  import './appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import { CHIPS, pinLabel, sides, usedIn, type Role } from './pinouts';

  let { n }: { n?: string | number } = $props();

  const ROW = 24;
  const BODY_W = 132;
  const LEG = 26;
  const PAD = 6;
  const W = BODY_W + 2 * LEG + 2 * PAD;
  const ROLES: { role: Role; label: string }[] = [
    { role: 'power', label: 'supply' },
    { role: 'ground', label: 'ground' },
    { role: 'in', label: 'input' },
    { role: 'out', label: 'output' },
    { role: 'clock', label: 'clock' },
    { role: 'control', label: 'control' },
    { role: 'io', label: 'open-collector' },
  ];
</script>

<Widget title="Pinouts" {n} kind="Reference" live={false} caption="Every chip is seen from above with the notch at the top; pin 1 is at the top left and the numbers run down the left side, then up the right. A bar over a name means the pin is active low.">
  {#snippet controls()}
    <ul class="legend" aria-label="Colour key">
      {#each ROLES as r (r.role)}
        <li><span class="dot {r.role}"></span>{r.label}</li>
      {/each}
    </ul>
  {/snippet}

  <div class="chips">
    {#each CHIPS as chip (chip.id)}
      {@const s = sides(chip)}
      {@const rows = chip.pins.length / 2}
      {@const H = rows * ROW + 26}
      <section class="chip" aria-labelledby="chip-{chip.id}">
        <header>
          <h5 id="chip-{chip.id}"><span class="part">{chip.part}</span> {chip.title}</h5>
          <p>{chip.summary}</p>
        </header>
        <svg viewBox="0 0 {W} {H}" width={W} height={H} role="img" aria-label="{chip.part} pinout, {chip.pins.length} pins: {chip.pins.map((p, i) => `${i + 1} ${pinLabel(p)}`).join(', ')}">
          <rect class="body" x={PAD + LEG} y="6" width={BODY_W} height={rows * ROW + 8} rx="4" />
          <path class="notch" d="M{PAD + LEG + BODY_W / 2 - 9} 6 a9 9 0 0 0 18 0" />
          {#each s.left as { n: num, pin }, k (num)}
            {@const cy = 24 + k * ROW}
            <path class="leg {pin.role}" d="M{PAD} {cy} H{PAD + LEG}" />
            <text class="num" x={PAD + LEG - 4} y={cy - 4} text-anchor="end">{num}</text>
            <text class="name {pin.role}" class:low={pin.low} x={PAD + LEG + 8} y={cy + 4} text-anchor="start">{pin.name}</text>
          {/each}
          {#each s.right as { n: num, pin }, k (num)}
            {@const cy = 24 + k * ROW}
            <path class="leg {pin.role}" d="M{PAD + LEG + BODY_W} {cy} H{W - PAD}" />
            <text class="num" x={PAD + LEG + BODY_W + 4} y={cy - 4} text-anchor="start">{num}</text>
            <text class="name {pin.role}" class:low={pin.low} x={PAD + LEG + BODY_W - 8} y={cy + 4} text-anchor="end">{pin.name}</text>
          {/each}
        </svg>
        <details>
          <summary>Pin functions</summary>
          <table>
            <thead><tr><th>Pin</th><th>Name</th><th>What it does</th></tr></thead>
            <tbody>
              {#each chip.pins as pin, i (i)}
                <tr>
                  <td>{i + 1}</td>
                  <td><span class="dot {pin.role}"></span><span class:low={pin.low}>{pin.name}</span></td>
                  <td>{pin.note ?? ''}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </details>
        {#if chip.labs.length}<p class="used">Labs: {usedIn(chip)}.</p>{/if}
        {#if chip.note}<p class="note">{chip.note}</p>{/if}
      </section>
    {/each}
  </div>
</Widget>

<style>
  .legend {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.9rem;
    margin: 0 !important;
    padding: 0 !important;
    font-family: var(--font-ui);
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .legend li {
    margin: 0 !important;
    padding: 0 !important;
  }
  .legend li::marker {
    content: '';
  }
  .dot {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    margin-right: 0.35rem;
    vertical-align: -0.05em;
    background: var(--role, var(--mute));
  }
  .power { --role: var(--volt-pos); }
  .ground { --role: var(--fg); }
  .in { --role: var(--series-1); }
  .out { --role: var(--series-3); }
  .clock { --role: var(--series-4); }
  .control { --role: var(--series-5); }
  .io { --role: var(--series-2); }

  .chips {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
    gap: 1rem;
    padding: 1rem 1.1rem 1.2rem;
  }
  .chip {
    display: grid;
    align-content: start;
    gap: 0.5rem;
    padding: 0.85rem 0.9rem 0.9rem;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 8px;
    min-width: 0;
  }
  h5 {
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    font-family: var(--font-display) !important;
    font-size: 0.95rem !important;
    line-height: 1.3 !important;
    color: var(--fg);
  }
  h5::before,
  h5::after {
    display: none !important;
  }
  .part {
    font-family: var(--font-mono);
    color: var(--copper-ink);
    margin-right: 0.3rem;
  }
  header p,
  .used,
  .note {
    margin: 0.15rem 0 0 !important;
    font-family: var(--font-ui);
    font-size: 0.8rem;
    line-height: 1.45;
    color: var(--ink-2);
  }
  .used {
    color: var(--mute);
  }
  svg {
    display: block;
    width: 100%;
    max-width: 14.5rem;
    height: auto;
    margin: 0.2rem auto;
  }
  .body {
    fill: var(--panel);
    stroke: var(--fg);
    stroke-width: 1.5;
  }
  .notch {
    fill: none;
    stroke: var(--fg);
    stroke-width: 1.5;
  }
  .leg {
    stroke: var(--role);
    stroke-width: 4;
    stroke-linecap: butt;
    fill: none;
  }
  .num {
    fill: var(--mute);
    font-family: var(--font-mono);
    font-size: 9px;
  }
  .name {
    font-family: var(--font-mono);
    font-size: 11.5px;
    font-weight: 600;
    fill: var(--fg);
  }
  .name.low,
  td .low {
    text-decoration: overline;
  }
  details summary {
    cursor: pointer;
    font-family: var(--font-ui);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--ink-2);
  }
  table {
    width: 100%;
    margin-top: 0.4rem;
    border-collapse: collapse;
    font-family: var(--font-ui);
    font-size: 0.78rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.2rem 0.35rem;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
  td:nth-child(2) {
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  thead th {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--mute);
  }
</style>
