// Page script for chapter "relativity": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const MUON_MC2 = 0.10566; // GeV
const MUON_CTAU = 658.6; // m (τ = 2.197 μs)

// Muons from the upper atmosphere
compute('muGamma', ['Emu'], ({ Emu }) => fmt(Emu / MUON_MC2, 3));
compute('muSurv', ['Emu', 'hmu'], ({ Emu, hmu }) => {
  const g = Emu / MUON_MC2, bg = Math.sqrt(g * g - 1);
  return `${fmt(100 * Math.exp((-hmu * 1000) / (bg * MUON_CTAU)), 3)}%`;
});
compute('muNaive', ['hmu'], ({ hmu }) => `${fmt(100 * Math.exp((-hmu * 1000) / MUON_CTAU), 2)}%`);

// GRB jets: beaming cone and arrival-time compression
compute('grbCone', ['Gam'], ({ Gam }) => `${fmt((180 / Math.PI) / Gam, 3)}°`);
compute('grbComp', ['Gam'], ({ Gam }) => fmt(2 * Gam * Gam, 3));
compute('grbR', ['Gam', 'dtv'], ({ Gam, dtv }) => {
  const R = 2 * Gam * Gam * 3e8 * dtv * 1e-3; // m
  return `${fmt(R, 2)} m (${fmt(R / 1.496e11, 2)} AU)`;
});

// Doppler boosting of a blazar
compute('boost', ['dop', 'alpha'], ({ dop, alpha }) => fmt(dop ** (3 + alpha), 3));

// Synchrotron characteristic frequency ν_c ≈ (3/2) γ² ν_g, ν_g = eB / (2π m_e) = 2.80 MHz/G
compute('nuSync', ['gsync', 'Bsync'], ({ gsync, Bsync }) => {
  const nu = 1.5 * gsync * gsync * 2.8e6 * Bsync * 1e-6; // B in μG
  const band = nu < 3e11 ? 'radio' : nu < 4e14 ? 'infrared' : nu < 7.5e14 ? 'visible' : nu < 3e16 ? 'ultraviolet' : 'X-ray';
  return `${fmt(nu, 2)} Hz (${band})`;
});
