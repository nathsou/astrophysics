<!--
  The same sentence (Article 1 of the Universal Declaration of Human Rights) in ten languages,
  and how many tokens each tokeniser needs for it. Token count is what you pay for — in money,
  latency and context window.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { tokenise, type TokeniserKind } from '../shared';

  const UDHR: { lang: string; text: string }[] = [
    { lang: 'English', text: 'All human beings are born free and equal in dignity and rights. They are endowed with reason and conscience and should act towards one another in a spirit of brotherhood.' },
    { lang: 'French', text: 'Tous les êtres humains naissent libres et égaux en dignité et en droits. Ils sont doués de raison et de conscience et doivent agir les uns envers les autres dans un esprit de fraternité.' },
    { lang: 'German', text: 'Alle Menschen sind frei und gleich an Würde und Rechten geboren. Sie sind mit Vernunft und Gewissen begabt und sollen einander im Geist der Brüderlichkeit begegnen.' },
    { lang: 'Spanish', text: 'Todos los seres humanos nacen libres e iguales en dignidad y derechos y, dotados como están de razón y conciencia, deben comportarse fraternalmente los unos con los otros.' },
    { lang: 'Russian', text: 'Все люди рождаются свободными и равными в своем достоинстве и правах. Они наделены разумом и совестью и должны поступать в отношении друг друга в духе братства.' },
    { lang: 'Greek', text: 'Όλοι οι άνθρωποι γεννιούνται ελεύθεροι και ίσοι στην αξιοπρέπεια και τα δικαιώματα. Είναι προικισμένοι με λογική και συνείδηση, και οφείλουν να συμπεριφέρονται μεταξύ τους με πνεύμα αδελφοσύνης.' },
    { lang: 'Arabic', text: 'يولد جميع الناس أحرارًا متساوين في الكرامة والحقوق. وقد وهبوا عقلاً وضميرًا وعليهم أن يعامل بعضهم بعضًا بروح الإخاء.' },
    { lang: 'Hindi', text: 'सभी मनुष्यों को गौरव और अधिकारों के मामले में जन्मजात स्वतन्त्रता और समानता प्राप्त है। उन्हें बुद्धि और अन्तरात्मा की देन प्राप्त है और परस्पर उन्हें भाईचारे के भाव से बर्ताव करना चाहिए।' },
    { lang: 'Chinese', text: '人人生而自由，在尊严和权利上一律平等。他们赋有理性和良心，并应以兄弟关系的精神相对待。' },
    { lang: 'Japanese', text: 'すべての人間は、生まれながらにして自由であり、かつ、尊厳と権利とについて平等である。人間は、理性と良心とを授けられており、互いに同胞の精神をもって行動しなければならない。' },
  ];

  let kind = $state<TokeniserKind>('gpt2');
  let counts = $state<number[]>([]);

  $effect(() => {
    const k = kind;
    let cancelled = false;
    Promise.all(UDHR.map((u) => tokenise(k, u.text))).then((r) => {
      if (!cancelled) counts = r.map((t) => t.length);
    });
    return () => (cancelled = true);
  });

  const en = $derived(counts[0] ?? 1);
  const max = $derived(Math.max(1, ...counts));
</script>

<Widget
  title="The same sentence costs different amounts"
  subtitle="Article 1 of the Universal Declaration of Human Rights in ten languages. Bars show tokens needed; the multiplier is relative to English."
>
  {#snippet controls()}
    <Segmented
      label="Tokeniser"
      size="sm"
      options={[
        { value: 'gpt2', label: 'GPT-2' },
        { value: 'bpe', label: 'Our Shakespeare BPE' },
        { value: 'bytes', label: 'UTF-8 bytes' },
        { value: 'chars', label: 'Characters' },
      ]}
      bind:value={kind}
    />
  {/snippet}

  <div class="rows" role="table" aria-label="Tokens per language">
    {#each UDHR as u, i (u.lang)}
      {@const c = counts[i] ?? 0}
      <div class="row" role="row" title={u.text}>
        <span class="lang" role="rowheader">{u.lang}</span>
        <span class="track"><span class="bar" style:width="{(c / max) * 100}%"></span></span>
        <span class="val num">{c}</span>
        <span class="ratio num">{i === 0 ? '' : `${(c / en).toFixed(1)}×`}</span>
      </div>
    {/each}
  </div>
  <p class="foot">
    Hover a row to read the sentence. The characters view shows the sentences are of similar length; the differences under GPT-2 come from how much of each script its training data contained.
  </p>
</Widget>

<style>
  .rows {
    display: grid;
    gap: 3px;
  }
  .row {
    display: grid;
    grid-template-columns: 5.5rem 1fr 3rem 3rem;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.82rem;
    padding: 1px 0.3rem;
    border-radius: 4px;
  }
  .row:hover {
    background: var(--surface-2);
  }
  .track {
    height: 14px;
    display: flex;
    align-items: center;
  }
  .bar {
    height: 12px;
    background: var(--series-1);
    border-radius: 0 4px 4px 0;
    transition: width 300ms ease;
  }
  .val {
    text-align: right;
  }
  .ratio {
    color: var(--ink-2);
    text-align: right;
  }
  .foot {
    font-size: 0.76rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
