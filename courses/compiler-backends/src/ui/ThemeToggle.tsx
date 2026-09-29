import { applyTheme, themeStore, useStore, type Theme } from './store';

/** Cycles system -> light -> dark; the choice is shared with the other courses via localStorage `theme`. */
export function ThemeToggle({ className = 'chip-btn' }: { className?: string }) {
  const theme = useStore(themeStore);
  const cycle = () => {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    themeStore.set(next);
    applyTheme(next);
  };
  return (
    <button className={className} onClick={cycle} title={`Theme: ${theme} (click to change)`} aria-label={`Theme: ${theme}. Switch theme`}>
      {theme === 'system' ? '◐ system' : theme === 'dark' ? '☾ dark' : '☀ light'}
    </button>
  );
}
