/**
 * Implementation registry: widgets ask for an implementation by key (e.g. "text.utf8Encode") and
 * get either the course's reference implementation or — if the learner has passed the exercise
 * and switched it on — their own code.
 */
import { LIBRARY, evaluate } from './modules';

class Implementations {
  overrides: Record<string, unknown> = $state({});
  /** key → exercise id that currently provides it */
  sources: Record<string, string> = $state({});

  get<T>(key: string, reference: T): T {
    return (this.overrides[key] as T | undefined) ?? reference;
  }

  isMine(key: string): boolean {
    return key in this.overrides;
  }

  /** Evaluate learner code and install the exports named in `provides`. Throws on failure. */
  install(exerciseId: string, code: string, provides: Record<string, string>): void {
    const mod = evaluate(code, `${exerciseId}/solution.ts`, (s) => LIBRARY[s]);
    for (const [exportName, key] of Object.entries(provides)) {
      if (typeof mod[exportName] !== 'function') throw new Error(`Your module does not export a function named ${exportName}`);
      this.overrides[key] = mod[exportName];
      this.sources[key] = exerciseId;
    }
  }

  uninstall(exerciseId: string): void {
    for (const [key, src] of Object.entries(this.sources)) {
      if (src === exerciseId) {
        delete this.overrides[key];
        delete this.sources[key];
      }
    }
  }
}

export const impl = new Implementations();
