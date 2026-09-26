// Page script for appendix A8 "Waves, Light & Fourier": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const C_KMS = 299792.458;

// Doppler shift of Hα (656.28 nm) for a line-of-sight velocity v (km/s); positive = receding.
compute('dlam', ['vr'], ({ vr }) => {
  const b = vr / C_KMS;
  const z = Math.sqrt((1 + b) / (1 - b)) - 1;
  return `${fmt(656.28 * z, 3)} nm`;
});
compute('zdop', ['vr'], ({ vr }) => {
  const b = vr / C_KMS;
  return fmt(Math.sqrt((1 + b) / (1 - b)) - 1, 3);
});

// Nyquist: the highest frequency a given sampling rate can represent.
compute('nyq', ['fs'], ({ fs }) => (fs >= 2000 ? `${fmt(fs / 2000, 3)} kHz` : `${fmt(fs / 2, 3)} Hz`));
