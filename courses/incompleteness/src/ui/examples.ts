export const FORMULA_EXAMPLES = [
  { label: 'v₀ = 0 (the book’s example)', value: 'x = 0' },
  { label: 'every number is 0 or a successor', value: '∀x (x = 0 ∨ ∃y x = y′)' },
  { label: 'Q1: successor is injective', value: '∀x ∀y (x′ = y′ → x = y)' },
  { label: 'x is even', value: '∃z (z + z) = x' },
  { label: 'x < y by Q8', value: "∃z (z′ + x) = y" },
  { label: 'a numeral: 2 + 2 = 4', value: '(2 + 2) = 4' },
  { label: 'a biconditional (defined)', value: 'x < y ↔ ∃z (z′ + x) = y' },
];

export const B_EXAMPLES = [
  { label: '¬Prov(x): “I am not provable”', value: '¬Prov(x)' },
  { label: 'Prov(x): “I am provable” (Löb)', value: 'Prov(x)' },
  { label: 'x is even', value: '∃z (z + z) = x' },
  { label: 'x = 0', value: 'x = 0' },
  { label: 'x ≠ x (always false)', value: '¬x = x' },
];
