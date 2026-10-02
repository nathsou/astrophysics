/** Small, framework-independent draft store. Unavailable storage never blocks the editor. */
export function readDraft(key: string | undefined, fallback: string): string {
  if (!key) return fallback;
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function saveDraft(key: string | undefined, text: string): void {
  if (!key) return;
  try { localStorage.setItem(key, text); } catch { /* export remains available */ }
}
export function exportDraft(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
