/**
 * Plug points for the reader's code.
 *
 * A pipeline function that an exercise asks the reader to write is fetched through `hook(name, reference)`.
 * When the reader's version has been installed with `setOverride` (the *use my code* toggle), it is returned
 * instead of the reference, so the reader's code runs inside the whole pipeline.
 *
 *     const fit = hook('reco.circleFit', referenceCircleFit);
 *
 * Names are `<stage>.<function>`, and each code exercise declares the name it feeds.
 */
type Fn = (...args: never[]) => unknown;

const overrides = new Map<string, Fn>();

/** Returns the reader's override for `name` if one is installed, else `reference`. */
export function hook<F extends Fn>(name: string, reference: F): F {
  return (overrides.get(name) as F | undefined) ?? reference;
}
/** Install (or, with `undefined`, remove) the reader's implementation of a hook. */
export function setOverride(name: string, fn: Fn | undefined): void {
  if (fn) overrides.set(name, fn);
  else overrides.delete(name);
}
/** The names of the hooks currently overridden. */
export function activeOverrides(): string[] {
  return [...overrides.keys()];
}
