import { mergeConfig } from 'vite';
import base from './vite.config.ts';
// Private dev config of the Part I author (deleted when the work is finished): its own dependency cache.
export default mergeConfig(base, { cacheDir: '/tmp/pp-vite-cache-part1' });
