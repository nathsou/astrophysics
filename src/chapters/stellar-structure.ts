// Page script for chapter "stellar-structure": wires <Var>/<Out> computations.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const G = 6.6743e-11, Msun = 1.98847e30, Rsun = 6.957e8, mp = 1.67262192369e-27, kB = 1.380649e-23;

// Order-of-magnitude Fermi estimates: P_c ~ GM^2/R^4, T_c ~ GMm_p/(kR), used in the Fermi box.
compute('Pc_fermi', ['Mfermi', 'Rfermi'], ({ Mfermi, Rfermi }) => {
  const Pc = (G * (Mfermi * Msun) ** 2) / (Rfermi * Rsun) ** 4;
  return `${fmt(Pc, 3)} Pa`;
});
compute('Tc_fermi', ['Mfermi', 'Rfermi'], ({ Mfermi, Rfermi }) => {
  const Tc = (G * Mfermi * Msun * mp) / (kB * Rfermi * Rsun);
  return `${fmt(Tc, 3)} K`;
});

// Kelvin–Helmholtz timescale t_KH ~ GM^2/(RL), for the draggable estimate in the timescales section.
compute('tKH_fermi', ['MtKH'], ({ MtKH }) => {
  const Rsol = Math.pow(MtKH, 0.8);
  const Lsol = Math.pow(MtKH, 3.5);
  const M = MtKH * Msun, R = Rsol * Rsun, L = Lsol * 3.828e26;
  const tKH = (G * M * M) / (R * L);
  const yr = 3.15576e7;
  return `${fmt(tKH / yr / 1e6, 3)} Myr`;
});
