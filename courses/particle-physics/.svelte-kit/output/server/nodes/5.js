

export const index = 5;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/control-room/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/5.D-rdEQ5Y.js","_app/immutable/chunks/C1MU2Y5J.js","_app/immutable/chunks/xihTtKlq.js","_app/immutable/chunks/CySF57v5.js","_app/immutable/chunks/UK7i5rRI.js"];
export const stylesheets = ["_app/immutable/assets/5.CKB3itkr.css"];
export const fonts = [];
