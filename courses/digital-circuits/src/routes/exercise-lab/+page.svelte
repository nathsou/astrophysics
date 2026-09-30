<!--
  Development gallery for the exercise components (not linked from the course): the examples of
  tools/markdown/fixtures/exercises.md, each block parsed and shown as the component it compiles to.
-->
<script lang="ts">
  import YAML from 'yaml';
  import fixture from '../../../tools/markdown/fixtures/exercises.md?raw';
  import Build from '$lib/components/exercise/Build.svelte';
  import Debug from '$lib/components/exercise/Debug.svelte';
  import Golf from '$lib/components/exercise/Golf.svelte';
  import Measure from '$lib/components/exercise/Measure.svelte';
  import Asm from '$lib/components/exercise/Asm.svelte';
  import Hdl from '$lib/components/exercise/Hdl.svelte';
  import Fit from '$lib/components/exercise/Fit.svelte';
  import Decode from '$lib/components/exercise/Decode.svelte';
  import Route from '$lib/components/exercise/Route.svelte';
  import Place from '$lib/components/exercise/Place.svelte';

  const blocks = [...fixture.matchAll(/```(build|debug|golf|measure|asm|hdl|fit|decode|route|place)\n([\s\S]*?)```/g)].map((m, i) => ({ kind: m[1]!, spec: { ...(YAML.parse(m[2]!) as Record<string, unknown>), ...(['build', 'debug', 'golf', 'hdl', 'fit', 'decode', 'route', 'place'].includes(m[1]!) && typeof YAML.parse(m[2]!).prompt === 'string' ? { prompt: `<p>${String(YAML.parse(m[2]!).prompt).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>')}</p>` } : {}) }, i }));
  const comps = { build: Build, debug: Debug, golf: Golf, measure: Measure, asm: Asm, hdl: Hdl, fit: Fit, decode: Decode, route: Route, place: Place } as unknown as Record<string, typeof Build>;
</script>

<svelte:head><title>Exercise lab</title></svelte:head>

<article class="lab">
  <h1>Exercise lab</h1>
  <p>Every exercise type, from the compiler fixture. Solved exercises are remembered in this browser.</p>
  {#each blocks as b (b.i)}
    {@const C = comps[b.kind]!}
    <section id="ex-{b.i}"><C spec={b.spec as never} /></section>
  {/each}
</article>

<style>
  .lab {
    max-width: 56rem;
    margin: 0 auto;
    padding: 1rem 16px 4rem;
  }
</style>
