// Titles and one-line descriptions of the thirteen books (written for this edition).

export interface BookInfo {
  title: string;
  blurb: string;
  theme: 'plane' | 'proportion' | 'number' | 'incommensurable' | 'solid';
}

export const BOOKS: BookInfo[] = [
  { title: 'Triangles, parallels and area', theme: 'plane', blurb: 'The foundations: definitions, five postulates, five common notions, and 48 propositions, from the equilateral triangle to Pythagoras’ theorem and its converse.' },
  { title: 'Geometric algebra', theme: 'plane', blurb: 'Identities such as (a + b)² = a² + 2ab + b² stated and proved with rectangles and squares, the law of cosines, and squaring any polygon.' },
  { title: 'Circles', theme: 'plane', blurb: 'Chords, tangents and angles in circles: the inscribed angle theorem, the angle in a semicircle, and the power of a point.' },
  { title: 'Inscribed and circumscribed figures', theme: 'plane', blurb: 'Regular polygons fitted in and around circles: the triangle, square, pentagon, hexagon and fifteen-sided polygon.' },
  { title: 'The theory of proportion', theme: 'proportion', blurb: 'Eudoxus’ definition of equal ratios, which works for incommensurable magnitudes and anticipates Dedekind’s construction of the real numbers.' },
  { title: 'Similar figures', theme: 'plane', blurb: 'Proportion applied to geometry: similar triangles, mean proportionals, the angle-bisector theorem and the golden section.' },
  { title: 'Numbers: divisibility', theme: 'number', blurb: 'Whole numbers as multitudes of units: the Euclidean algorithm, primes, and least common multiples.' },
  { title: 'Numbers in continued proportion', theme: 'number', blurb: 'Geometric progressions of whole numbers, square and cube numbers, and when mean proportionals exist between them.' },
  { title: 'Numbers: primes, evens and odds', theme: 'number', blurb: 'The infinitude of the primes, the sum of a geometric series, and the construction of perfect numbers.' },
  { title: 'Incommensurable magnitudes', theme: 'incommensurable', blurb: 'The longest book: a classification of the irrational lines built from square roots, 115 propositions of what is now algebra with quadratic surds.' },
  { title: 'Solid geometry', theme: 'solid', blurb: 'Lines and planes in space, solid angles, and the volumes of parallelepipeds.' },
  { title: 'Measuring by exhaustion', theme: 'solid', blurb: 'The method of exhaustion: circles are as the squares on their diameters, pyramids are a third of prisms, spheres are as the cubes on their diameters.' },
  { title: 'The regular solids', theme: 'solid', blurb: 'The golden section in space, the construction of the five regular solids in a sphere, and the proof that there are no others.' },
];
