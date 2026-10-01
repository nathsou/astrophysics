import { mergeConfig } from 'vite';
import base from './vite.config.ts';
// Private dev config of the Control Room author (deleted when the work is finished): other agents' edits and svelte-kit sync must not reload the page mid-run.
export default mergeConfig(base, {
  server: { watch: { ignored: ['**/.svelte-kit/**', '**/content/chapters/**', '**/content/appendices/**', '**/src/lib/sims/**', '**/src/lib/hep/{gen,reco,detector,trigger,analysis,machine,shower,hadronise,decay,sm}/**', '**/dist/**', '**/.pp*', '**/.part8*'] } },
});
