import { describe, expect, test } from 'vitest';
import { canRedo, canUndo, commit, createHistory, redo, reset, undo } from './history';

describe('history', () => {
  test('commit, undo and redo', () => {
    let h = createHistory('a');
    expect(canUndo(h)).toBe(false);
    h = commit(h, 'b');
    h = commit(h, 'c');
    expect(h.present).toBe('c');
    h = undo(h);
    expect(h.present).toBe('b');
    expect(canRedo(h)).toBe(true);
    h = undo(h);
    h = undo(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    h = redo(h);
    h = redo(h);
    expect(h.present).toBe('c');
    expect(canRedo(h)).toBe(false);
  });

  test('committing the same state changes nothing', () => {
    const h = createHistory({ n: 1 });
    expect(commit(h, h.present)).toBe(h);
  });

  test('a new commit discards the redo stack', () => {
    let h = commit(commit(createHistory(1), 2), 3);
    h = undo(undo(h));
    h = commit(h, 9);
    expect(h.present).toBe(9);
    expect(canRedo(h)).toBe(false);
    expect(undo(h).present).toBe(1);
  });

  test('commits with one key close together are a single step', () => {
    let h = createHistory(0);
    h = commit(h, 1, { key: 'k', now: 1000 });
    h = commit(h, 2, { key: 'k', now: 1200 });
    h = commit(h, 3, { key: 'k', now: 1500 });
    expect(h.past).toEqual([0]);
    expect(undo(h).present).toBe(0);
  });

  test('a different key, or a long pause, starts a new step', () => {
    let h = createHistory(0);
    h = commit(h, 1, { key: 'a', now: 0 });
    h = commit(h, 2, { key: 'b', now: 100 });
    h = commit(h, 3, { key: 'b', now: 5000 });
    expect(h.past).toEqual([0, 1, 2]);
  });

  test('the first commit with a key is never merged into an older state', () => {
    const h = commit(createHistory('x'), 'y', { key: 'k', now: 0 });
    expect(h.past).toEqual(['x']);
  });

  test('undo then a keyed commit does not merge across the undo', () => {
    let h = commit(createHistory(0), 1, { key: 'k', now: 0 });
    h = undo(h);
    h = commit(h, 5, { key: 'k', now: 10 });
    expect(h.past).toEqual([0]);
    expect(h.present).toBe(5);
    h = undo(h);
    expect(h.present).toBe(0);
  });

  test('the number of steps is limited', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 10; i++) h = commit(h, i, { limit: 4 });
    expect(h.past).toEqual([6, 7, 8, 9]);
  });

  test('reset forgets everything', () => {
    const h = reset(commit(createHistory(1), 2), 7);
    expect(h.present).toBe(7);
    expect(canUndo(h)).toBe(false);
  });
});
