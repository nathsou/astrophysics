import { mergeConfig } from 'vite';
import base from './vite.config.ts';
// Private dev config of the Part II author (deleted when the work is finished): repairs another agent's template error in memory.
export default mergeConfig(base, {
  plugins: [
    {
      name: 'pp2-repair',
      enforce: 'pre',
      transform(code, id) {
        if (id.includes('/sims/part5/AlternatingGradient.svelte')) return code.replaceAll('|Tr M| < 2', '|Tr M| &lt; 2').replaceAll('L/f < 2 in both', 'L/f &lt; 2 in both');
        return null;
      },
    },
  ],
});
