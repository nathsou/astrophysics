// Widgets available in chapters. Heavy widgets are loaded lazily.
import { lazy } from 'solid-js';
import { Exercise } from './Exercise.tsx';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lz = <T,>(f: () => Promise<Record<string, T>>, name: string) => lazy(() => f().then((m) => ({ default: m[name] as never })));
void lz;

export const widgets: Record<string, unknown> = {
  Exercise,
};
