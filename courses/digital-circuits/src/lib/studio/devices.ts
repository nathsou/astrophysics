/** Registers the chip views of the built-in devices. Import for the side effect. */
import { registerChip } from './registry';
import PromChip from './chips/PromChip.svelte';
import PlaChip from './chips/PlaChip.svelte';
import GalChip from './chips/GalChip.svelte';
import CpldChip from './chips/CpldChip.svelte';

registerChip('prom', PromChip);
registerChip('pla', PlaChip);
registerChip('gal22v10', GalChip);
registerChip('cpld32', CpldChip);
