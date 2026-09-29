<!-- Sample chapter body for the style guide (what compiled Markdown looks like on a chapter page). -->
<script lang="ts">
  import Callout from '$lib/components/content/Callout.svelte';
</script>

<p>
  In 1937 a student at MIT noticed that the relays in a telephone exchange obey the same algebra as Boole’s logic. A switch is either
  open or closed; a lamp is either on or off. Put two switches in series and the lamp lights only when both are closed.
</p>
<h2 id="series-is-and">Series is AND</h2>
<p>Current has one path, through both switches. If either is open, the path is broken:</p>
<ul>
  <li>both closed: the lamp is on;</li>
  <li>anything else: the lamp is off.</li>
</ul>
<Callout kind="programmer"><p>Series switches are <code>a &amp;&amp; b</code>; parallel switches are <code>a || b</code>. The circuit evaluates both at once.</p></Callout>
<h2 id="parallel-is-or">Parallel is OR</h2>
<p>Now the current has two paths, and either one is enough. The staircase light, with a switch at each end, computes XOR.</p>
<h3 id="truth-tables">Truth tables</h3>
<table>
  <thead><tr><th>A</th><th>B</th><th>Series</th><th>Parallel</th></tr></thead>
  <tbody>
    <tr><td>0</td><td>0</td><td>0</td><td>0</td></tr>
    <tr><td>0</td><td>1</td><td>0</td><td>1</td></tr>
    <tr><td>1</td><td>0</td><td>0</td><td>1</td></tr>
    <tr><td>1</td><td>1</td><td>1</td><td>1</td></tr>
  </tbody>
</table>
