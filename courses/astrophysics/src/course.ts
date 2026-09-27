// Single source of truth for the course structure.
// A chapter is "published" when src/pages/ch/<slug>.mdx exists.

export interface ChapterMeta {
  /** Display number: 1…28 for chapters, 'A1'… for appendices. */
  n: number | string;
  slug: string;
  title: string;
  blurb: string;
}

export interface Part {
  roman: string;
  title: string;
  /** Appendix parts are labelled "Appendix" instead of "Part". */
  appendix?: boolean;
  chapters: ChapterMeta[];
}

export const parts: Part[] = [
  {
    roman: 'I',
    title: 'Foundations',
    chapters: [
      { n: 1, slug: 'scales', title: 'Scales & Units', blurb: 'Forty orders of magnitude, and how to think in logarithms.' },
      { n: 2, slug: 'orbits', title: 'Gravity & Orbits', blurb: 'Kepler, Newton, conserved quantities, and integrators that respect them.' },
      { n: 3, slug: 'three-body', title: 'Three Bodies & Chaos', blurb: 'The restricted three-body problem, Lagrange points and sensitive dependence.' },
      { n: 4, slug: 'light', title: 'Light & Blackbodies', blurb: 'Planck, Wien, Stefan–Boltzmann: the colour and brightness of hot things.' },
      { n: 5, slug: 'spectra', title: 'Spectra & Atoms', blurb: 'Line formation, Boltzmann and Saha, and why the stellar classes are ordered OBAFGKM.' },
    ],
  },
  {
    roman: 'II',
    title: 'Birth of Stars & Planets',
    chapters: [
      { n: 6, slug: 'ism', title: 'The Interstellar Medium', blurb: 'Gas, dust, phases and cooling: the raw material between the stars.' },
      { n: 7, slug: 'star-formation', title: 'Star Formation', blurb: 'Jeans instability, free-fall collapse, fragmentation and protostars.' },
      { n: 8, slug: 'planet-formation', title: 'Planet Formation', blurb: 'Protoplanetary disks, dust growth, planetesimals, the snow line and migration.' },
      { n: 9, slug: 'tides', title: 'Tides, Rings & Resonances', blurb: 'Tidal forces, the Roche limit and orbital resonances.' },
      { n: 10, slug: 'exoplanets', title: 'Finding Exoplanets', blurb: 'Transits, radial velocities and periodograms: pulling planets out of noise.' },
    ],
  },
  {
    roman: 'III',
    title: 'The Life of Stars',
    chapters: [
      { n: 11, slug: 'stellar-structure', title: 'Stellar Structure', blurb: 'Hydrostatic equilibrium, the virial theorem and polytropes.' },
      { n: 12, slug: 'fusion', title: 'Nuclear Fusion', blurb: 'Quantum tunnelling, the Gamow peak, the pp-chain and CNO cycle.' },
      { n: 13, slug: 'energy-transport', title: 'Energy Transport', blurb: 'Opacity, the photon random walk and convection.' },
      { n: 14, slug: 'main-sequence', title: 'The Main Sequence', blurb: 'The HR diagram, mass–luminosity relations and stellar lifetimes.' },
      { n: 15, slug: 'giants', title: 'Giants & Late Stages', blurb: 'Shell burning, the helium flash, the AGB and planetary nebulae.' },
      { n: 16, slug: 'stellar-death', title: 'Stellar Death', blurb: 'Degeneracy pressure, the Chandrasekhar limit and core-collapse supernovae.' },
    ],
  },
  {
    roman: 'IV',
    title: 'Relativity & Compact Objects',
    chapters: [
      { n: 17, slug: 'relativity', title: 'Special Relativity', blurb: 'Lorentz transforms, aberration and relativistic beaming.' },
      { n: 18, slug: 'neutron-stars', title: 'Neutron Stars & Pulsars', blurb: 'Nuclear-density matter, magnetic dipoles and cosmic lighthouses.' },
      { n: 19, slug: 'black-holes', title: 'Black Holes', blurb: 'The Schwarzschild metric, geodesics, the photon sphere and accretion disks.' },
      { n: 20, slug: 'gravitational-waves', title: 'Gravitational Waves', blurb: 'The quadrupole formula, inspiral chirps and what LIGO hears.' },
    ],
  },
  {
    roman: 'V',
    title: 'Galaxies',
    chapters: [
      { n: 21, slug: 'milky-way', title: 'The Milky Way & Dark Matter', blurb: 'Rotation curves, halos and the missing mass.' },
      { n: 22, slug: 'galactic-dynamics', title: 'Galactic Dynamics', blurb: 'Collisionless systems, spiral density waves and galaxy collisions.' },
      { n: 23, slug: 'galaxy-formation', title: 'Galaxy Formation & AGN', blurb: 'Hierarchical assembly, gas cooling, feedback and supermassive black holes.' },
      { n: 24, slug: 'lensing', title: 'Gravitational Lensing', blurb: 'The lens equation, Einstein rings and microlensing.' },
    ],
  },
  {
    roman: 'VI',
    title: 'Cosmology',
    chapters: [
      { n: 25, slug: 'expansion', title: 'The Expanding Universe', blurb: 'The FLRW metric, the Friedmann equations and cosmic distances.' },
      { n: 26, slug: 'big-bang', title: 'The Hot Big Bang', blurb: 'Thermal history, nucleosynthesis and recombination.' },
      { n: 27, slug: 'cmb', title: 'The Cosmic Microwave Background', blurb: 'Acoustic oscillations and the angular power spectrum.' },
      { n: 28, slug: 'structure', title: 'Cosmic Structure', blurb: 'Linear growth, the particle-mesh method and the cosmic web.' },
    ],
  },
  {
    roman: 'A',
    title: 'Appendix: Primers',
    appendix: true,
    chapters: [
      { n: 'A1', slug: 'primer-numbers', title: 'Numbers, Units & Logarithms', blurb: 'Scientific notation, significant figures, logs and log scales, dimensional analysis.' },
      { n: 'A2', slug: 'primer-functions', title: 'Functions, Powers & Exponentials', blurb: 'Power laws, exponentials, trigonometry, and reading log–log plots.' },
      { n: 'A3', slug: 'primer-vectors', title: 'Vectors & Coordinates', blurb: 'Vectors, dot and cross products, polar and spherical coordinates, frames.' },
      { n: 'A4', slug: 'primer-calculus', title: 'Calculus in a Hurry', blurb: 'Derivatives, integrals, Taylor series, gradients — the ideas and the rules you need.' },
      { n: 'A5', slug: 'primer-odes', title: 'Differential Equations & Numerics', blurb: 'ODEs, stability, integrators, root finding and the tools behind every simulation.' },
      { n: 'A6', slug: 'primer-mechanics', title: 'Classical Mechanics', blurb: 'Newton, energy, momentum, angular momentum, potentials and conservation laws.' },
      { n: 'A7', slug: 'primer-thermo', title: 'Heat, Gases & Statistics', blurb: 'Temperature, the ideal gas, the Boltzmann factor, entropy and distributions.' },
      { n: 'A8', slug: 'primer-waves', title: 'Waves, Light & Fourier', blurb: 'Waves, the Doppler effect, electromagnetism in brief, and Fourier analysis.' },
      { n: 'A9', slug: 'primer-quantum', title: 'Quantum Ideas', blurb: 'Photons, uncertainty, energy levels, spin, Pauli exclusion and tunnelling.' },
    ],
  },
];

export const chapters: (ChapterMeta & { part: Part })[] = parts.flatMap((p) =>
  p.chapters.map((c) => ({ ...c, part: p })),
);

export function chapterBySlug(slug: string) {
  return chapters.find((c) => c.slug === slug);
}
