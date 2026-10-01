<!--
  A cathode-ray tube in the manner of Thomson's 1897 experiment: a beam of electrons crosses an electric field (vertical, between two plates) and a
  magnetic field (out of or into the page). Adjust B until the spot returns to the centre: then the two forces balance, the speed is v = E/B, and the
  charge-to-mass ratio follows from the accelerating voltage, e/m = v²/2V. (Non-relativistic: at 3 kV the electron's speed is 10 % of c and the
  correction is under 2 %.)
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  // The electron's true e/m in C/kg (CODATA 2018): used by the tube, hidden until "Reveal".
  const E_OVER_M = 1.75882001076e11;
  const ELL = 0.05; // m: length of the plates (and of the magnetic field region)
  const LDRIFT = 0.25; // m: from the plates to the screen

  let V = $state(1500); // accelerating voltage [V]
  let Efield = $state(8000); // V/m: plate field
  let Bmt = $state(0); // mT, signed: + out of the page
  let revealed = $state(false);

  const v = $derived(Math.sqrt(2 * E_OVER_M * V)); // m/s
  const beta = $derived(v / 2.99792458e8);
  // deflection at the screen (m), positive up. Electron charge −e: E up pushes it down; B out of the page pushes it up.
  const yE = $derived(-(E_OVER_M * Efield * ELL) / (v * v) * (ELL / 2 + LDRIFT));
  const yB = $derived(((E_OVER_M * (Bmt * 1e-3) * ELL) / v) * (ELL / 2 + LDRIFT));
  const y = $derived(yE + yB);
  const Bbalance = $derived(Efield / v); // T
  const W = 520, H = 220;
  const x0 = 20, xp0 = 130, xp1 = 190, xs = 500;
  const mmToPx = 3.2; // px per mm of deflection at the screen
  const yPx = $derived(Math.max(-90, Math.min(90, -y * 1000 * mmToPx)));
  const balanced = $derived(Math.abs(y) < 0.0005);
  // what the reader would compute from the readings
  const vRead = $derived(Bmt !== 0 ? Efield / Math.abs(Bmt * 1e-3) : NaN);
  const emRead = $derived(Number.isFinite(vRead) ? (vRead * vRead) / (2 * V) : NaN);

  function findBalance() {
    Bmt = Math.round(Bbalance * 1e3 * 100) / 100;
  }
  const sci = (x: number) => x.toExponential(3).replace('e+', ' × 10^').replace(/\^(\d+)/, (_, d) => `^${d}`);
</script>

<Widget title="Thomson's tube" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={V} min={300} max={3000} step={50} label="Accelerating voltage V [V]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={Efield} min={0} max={20000} step={250} label="Electric field E between the plates [V/m]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={Bmt} min={-3} max={3} step={0.01} label="Magnetic field B [mT] (+ out of the page)" format={(v) => v.toFixed(2)} />
    <Button onclick={findBalance}>Balance the forces</Button>
    <Button onclick={() => (revealed = !revealed)}>{revealed ? 'Hide' : 'Reveal'} the true value</Button>
  {/snippet}
  <div class="grid">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Electrons leave a gun on the left, cross two deflecting plates with a magnetic field and strike a screen on the right; the spot moves with the fields" class="tube">
      <rect x={x0 - 10} y={H / 2 - 12} width="22" height="24" fill="var(--pn)" stroke="var(--line-strong)" />
      <text x={x0 - 8} y={H / 2 + 30} class="lbl">gun</text>
      <rect x={xp0} y={H / 2 - 38} width={xp1 - xp0} height="6" fill="var(--volt-pos)" opacity="0.7" />
      <rect x={xp0} y={H / 2 + 32} width={xp1 - xp0} height="6" fill="var(--volt-neg)" opacity="0.7" />
      <text x={(xp0 + xp1) / 2} y={H / 2 - 46} class="lbl" text-anchor="middle">plates (E ↑)</text>
      {#each [0, 1, 2] as i}<text x={xp0 + 8 + i * 22} y={H / 2 + 4} class="bmark" text-anchor="middle">{Bmt >= 0 ? '⊙' : '⊗'}</text>{/each}
      <line x1={xs} x2={xs} y1="10" y2={H - 10} stroke="var(--fg)" stroke-width="3" />
      <text x={xs - 6} y="22" class="lbl" text-anchor="end">screen</text>
      <line x1={x0 + 12} y1={H / 2} x2={xp0} y2={H / 2} stroke="var(--p-electron)" stroke-width="2.5" />
      <path d="M{xp0},{H / 2} Q{(xp0 + xp1) / 2},{H / 2} {xp1},{H / 2 + yPx * 0.12} L{xs},{H / 2 + yPx}" fill="none" stroke="var(--p-electron)" stroke-width="2.5" />
      <circle cx={xs} cy={H / 2 + yPx} r="6" fill={balanced ? 'var(--ok)' : 'var(--sig-high)'} />
      <line x1={xs - 14} x2={xs + 14} y1={H / 2} y2={H / 2} stroke="var(--mute)" stroke-dasharray="3 2" />
    </svg>
    <table class="ui">
      <tbody>
        <tr><th>speed after V = {V} V</th><td>{(v / 1e6).toFixed(1)} × 10⁶ m/s = {(100 * beta).toFixed(1)} % of c</td></tr>
        <tr><th>spot on the screen</th><td>{(y * 1000).toFixed(1)} mm {balanced ? '(on the axis)' : y > 0 ? '(up)' : '(down)'}</td></tr>
        <tr><th>electric deflection alone</th><td>{(yE * 1000).toFixed(1)} mm</td></tr>
        <tr><th>magnetic deflection alone</th><td>{(yB * 1000).toFixed(1)} mm</td></tr>
        <tr><th>v = E/B at this B</th><td>{Number.isFinite(vRead) ? (vRead / 1e6).toFixed(2) + ' × 10⁶ m/s' : '–'}</td></tr>
        <tr><th>e/m = v²/2V, if balanced</th><td>{Number.isFinite(emRead) ? sci(emRead) + ' C/kg' : '–'}</td></tr>
        {#if revealed}<tr><th>true e/m (CODATA)</th><td>{sci(E_OVER_M)} C/kg</td></tr>{/if}
      </tbody>
    </table>
  </div>
  <p class="ui note">Only when the spot is on the axis does E/B equal the speed: read the last two rows then. The mass of a hydrogen ion is about 1,836 times the electron's; Thomson found that the rays' charge-to-mass ratio was about a thousand times that of the hydrogen ion in electrolysis.</p>
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .tube {
    width: 100%;
    background: var(--scope-bg);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
  }
  .lbl {
    font-size: 10.5px;
    fill: #bcc6d2;
  }
  .bmark {
    fill: #8f9bab;
    font-size: 13px;
  }
  table {
    border-collapse: collapse;
    font-size: 0.82rem;
    width: 100%;
  }
  th,
  td {
    text-transform: none;
    letter-spacing: 0;
    text-align: left;
    padding: 0.2rem 0.4rem;
    border-bottom: 1px solid var(--line);
    font-weight: 400;
  }
  td {
    font-family: var(--font-mono);
    text-align: right;
  }
  .note {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
