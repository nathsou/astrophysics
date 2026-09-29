// A single shared tooltip element.
let el: HTMLDivElement | undefined;

function ensure(): HTMLDivElement {
  if (!el) {
    el = document.createElement('div');
    el.className = 'tooltip';
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

export function showTooltip(x: number, y: number, content: Node | string): void {
  const t = ensure();
  t.replaceChildren(typeof content === 'string' ? document.createTextNode(content) : content);
  t.style.display = 'block';
  const r = t.getBoundingClientRect();
  let left = x + 12;
  let top = y + 16;
  if (left + r.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - r.width - 8);
  if (top + r.height > window.innerHeight - 8) top = y - r.height - 10;
  t.style.left = `${left}px`;
  t.style.top = `${top}px`;
}

export function hideTooltip(): void {
  if (el) el.style.display = 'none';
}
