// Page script for chapter "expansion": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

// Hubble's law: v = H0 d
compute('hubblev', ['hubbled', 'hubbleH0'], ({ hubbled, hubbleH0 }) => `${fmt(hubbleH0 * hubbled, 4)} km/s`);

// 1 + z = 1/a
compute('zfroma', ['zoa'], ({ zoa }) => fmt(1 / zoa - 1, 4));

// Hubble time from H0
compute('thubble', ['thH0'], ({ thH0 }) => `${fmt(977.8 / thH0, 4)} Gyr`);
