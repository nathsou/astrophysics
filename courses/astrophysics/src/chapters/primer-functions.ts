// Page script for Appendix A2: power-law scaling of main-sequence luminosity and lifetime.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

compute('msL', ['msM'], ({ msM }) => `${fmt(msM ** 3.5, 3)} L☉`);
compute('msT', ['msM'], ({ msM }) => {
  const t = 1e10 * msM ** -2.5; // years
  return t >= 1e9 ? `${fmt(t / 1e9, 3)} billion years` : `${fmt(t / 1e6, 3)} million years`;
});
compute('halfLeft', ['halfT'], ({ halfT }) => `${fmt(100 * 0.5 ** (halfT / 6.08), 3)}%`);
