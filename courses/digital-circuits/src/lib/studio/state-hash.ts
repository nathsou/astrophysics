/**
 * The Studio's state in a URL hash, so "Open in the Studio" carries a design from a chapter and links can
 * be shared: `#d=gal22v10&e=traffic-light` for an example, `#d=cpld32&s=<source>` for a custom source
 * (URL-safe base64 of the UTF-8 text). `v=` lists the visible views.
 */
export interface StudioState {
  device: string;
  example?: string;
  source?: string;
  views?: string[];
}

const b64 = (s: string): string => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const unb64 = (s: string): string => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function encodeState(state: StudioState): string {
  const parts = [`d=${encodeURIComponent(state.device)}`];
  if (state.example) parts.push(`e=${encodeURIComponent(state.example)}`);
  else if (state.source !== undefined) parts.push(`s=${b64(state.source)}`);
  if (state.views?.length) parts.push(`v=${state.views.join(',')}`);
  return `#${parts.join('&')}`;
}

export function decodeState(hash: string): StudioState | null {
  const h = hash.replace(/^#/, '');
  if (!h) return null;
  const q = new URLSearchParams(h);
  const device = q.get('d');
  if (!device) return null;
  const state: StudioState = { device };
  const e = q.get('e');
  if (e) state.example = e;
  const s = q.get('s');
  if (s) {
    try {
      state.source = unb64(s);
    } catch {
      /* a damaged link: fall back to the device's first example */
    }
  }
  const v = q.get('v');
  if (v) state.views = v.split(',').filter(Boolean);
  return state;
}
