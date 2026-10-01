/** A counter for unique element ids (for aria-describedby), shared by the components. */
let counter = 0;
export const nextId = (): number => ++counter;
