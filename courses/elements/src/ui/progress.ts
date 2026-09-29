// What the reader has visited, and which workshop tools they have unlocked (kept in this browser).
import { persistentStore } from './store';

export const readStore = persistentStore<Record<string, number>>('elements.read', {});
export const markRead = (id: string) => {
  if (!readStore.get()[id]) readStore.set({ ...readStore.get(), [id]: Date.now() });
};
