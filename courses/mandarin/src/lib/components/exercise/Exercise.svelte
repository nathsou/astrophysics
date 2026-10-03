<script lang="ts">
  /** Dispatches a fenced exercise block to its component inside the shared frame. */
  import type { Component } from 'svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Choose from './Choose.svelte';
  import Fill from './Fill.svelte';
  import Tones from './Tones.svelte';
  import Pinyin from './Pinyin.svelte';
  import Order from './Order.svelte';
  import Match from './Match.svelte';
  import Sort from './Sort.svelte';
  import Scene from './Scene.svelte';
  import Story from './Story.svelte';
  import Write from './Write.svelte';
  import Speak from './Speak.svelte';
  import Roleplay from './Roleplay.svelte';
  import Compose from './Compose.svelte';

  let { kind, id, data }: { kind: string; id: string; data: any } = $props();

  const KINDS: Record<string, [Component<any>, string, string]> = {
    choose: [Choose, 'Quick check', 'sparkle'],
    fill: [Fill, 'Fill the gap', 'sparkle'],
    tones: [Tones, 'Tone detective', 'speaker'],
    pinyin: [Pinyin, 'Spell it in pinyin', 'book'],
    order: [Order, 'Sentence builder', 'shuffle'],
    match: [Match, 'Match up', 'cards'],
    sort: [Sort, 'Sort it out', 'cards'],
    scene: [Scene, 'Scene', 'chat'],
    story: [Story, 'Story', 'book'],
    write: [Write, 'Writing', 'brush'],
    speak: [Speak, 'Tone mirror', 'mic'],
    roleplay: [Roleplay, 'Conversation partner', 'chat'],
    compose: [Compose, 'Your own sentence', 'brush'],
  };
  const entry = $derived(KINDS[kind]);
</script>

{#if entry}
  {@const [C, label, icon] = entry}
  <ExerciseFrame {id} {label} {icon} title={data.title ?? null} optional={kind === 'roleplay' || kind === 'compose'}>
    {#snippet body(report)}
      <C {data} {id} {report} />
    {/snippet}
  </ExerciseFrame>
{:else}
  <p class="error">Unknown exercise “{kind}”.</p>
{/if}
