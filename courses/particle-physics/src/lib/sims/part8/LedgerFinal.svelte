<!--
  The ledger of Chapter 11 as it stands at the end of the weak-force chapters and Chapter 31: parity, charge conjugation and CP struck through by the weak force, and now
  lepton flavour struck through by neutrino oscillation. Struck rows are crossed out in the text and say so in words (colour is never the only cue).

    ::ledger-final{n="31.6" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let { n, caption, title = 'The ledger, with lepton flavour struck through' }: { n?: string | number; caption?: string; title?: string } = $props();

  interface Row {
    law: string;
    status: 'exact' | 'none-seen' | 'struck';
    what: string;
    chapter: string;
  }
  const ROWS: Row[] = [
    { law: 'Energy and momentum', status: 'exact', what: 'Never violated.', chapter: '' },
    { law: 'Electric charge', status: 'exact', what: 'Never violated.', chapter: '' },
    { law: 'Colour', status: 'exact', what: 'The strong force is exactly colour-symmetric; free colour is never seen.', chapter: 'Chapter 18' },
    { law: 'Baryon number', status: 'none-seen', what: 'No violation seen. The proton lifetime is above 10³⁴ years; grand unified theories predict violation.', chapter: 'Chapter 32' },
    { law: 'Total lepton number L = L_e + L_μ + L_τ', status: 'none-seen', what: 'No violation seen. If neutrinos are Majorana particles it is violated, in neutrinoless double-beta decay.', chapter: 'Chapter 31' },
    { law: 'Lepton flavour: L_e, L_μ, L_τ separately', status: 'struck', what: 'Violated by neutrino oscillation: a ν_μ made in a decay is detected as a ν_τ or a ν_e. Not seen in charged leptons (μ → eγ: branching fraction below 4.2 × 10⁻¹³).', chapter: 'Chapter 31' },
    { law: 'Strangeness, charm, bottom', status: 'struck', what: 'Conserved by the strong and electromagnetic forces, changed by the weak force by one unit.', chapter: 'Chapters 11 and 22' },
    { law: 'Parity P', status: 'struck', what: 'Violated by the weak force, maximally for the charged current.', chapter: 'Chapter 22' },
    { law: 'Charge conjugation C', status: 'struck', what: 'Violated by the weak force.', chapter: 'Chapter 22' },
    { law: 'CP', status: 'struck', what: 'Violated, but slightly: in kaons, B mesons and now baryons. Possibly large in neutrino oscillation (not yet measured).', chapter: 'Chapters 24, 31, 32' },
    { law: 'CPT', status: 'exact', what: 'Holds in every quantum field theory of this kind; no violation seen.', chapter: '' },
  ];
  const WORD = { exact: 'holds exactly', 'none-seen': 'no violation seen', struck: 'struck through: violated' } as const;
</script>

<Widget {title} {n} {caption} kind="Figure" live={false}>
  <table class="ui ledger">
    <thead><tr><th scope="col">Law</th><th scope="col">Status</th><th scope="col">What we know</th></tr></thead>
    <tbody>
      {#each ROWS as r}
        <tr class:struck={r.status === 'struck'} class:new={r.law.startsWith('Lepton flavour')}>
          <th scope="row"><span class="law">{r.law}</span></th>
          <td class="st st-{r.status}">{r.status === 'struck' ? '✗ ' : '✓ '}{WORD[r.status]}</td>
          <td>{r.what}{#if r.chapter}{' '}<span class="ch">({r.chapter})</span>{/if}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</Widget>

<style>
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.84rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
    text-transform: none;
    letter-spacing: 0;
  }
  thead th {
    background: var(--pn);
    font-weight: 600;
  }
  tbody th {
    font-weight: 600;
    width: 30%;
  }
  tr.struck .law {
    text-decoration: line-through;
    text-decoration-thickness: 2px;
    color: var(--ink-2);
  }
  tr.new {
    background: var(--maybe-soft);
  }
  .st {
    white-space: nowrap;
    font-weight: 500;
  }
  .st-struck {
    color: var(--bad);
  }
  .st-exact,
  .st-none-seen {
    color: var(--ok);
  }
  .ch {
    color: var(--mute);
    font-size: 0.78rem;
  }
  @media (max-width: 560px) {
    .st {
      white-space: normal;
    }
  }
</style>
