// Page script for chapter "big-bang": wires <Var>/<Out> computations.
// These are quick closed-form fits for the inline prose numbers (illustrative, ~10-20% accurate);
// the flagship sim solves the real reduced reaction network instead.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

compute('Yp', ['eta10'], ({ eta10 }) => fmt(0.239 + 0.011 * Math.log(eta10 / 6.1), 4));
compute('DH', ['eta10'], ({ eta10 }) => `${fmt(2.3e-5 * (eta10 / 6.1) ** -1.6, 3)}`);
compute('Li7H', ['eta10'], ({ eta10 }) => `${fmt(3.2e-10 * (eta10 / 6.1) ** 0.5, 3)}`);
