/** Shared types of the event display components. */

/** The four views of the display. */
export type ViewName = '3d' | 'rphi' | 'rz' | 'lego';
export const ALL_VIEWS: readonly ViewName[] = ['3d', 'rphi', 'rz', 'lego'];

/** Parse a `views` prop: an array or a comma-separated string ("3d,rphi"); unknown names are dropped. */
export function parseViews(views: readonly string[] | string | undefined, fallback: ViewName[] = ['3d']): ViewName[] {
  const list = typeof views === 'string' ? views.split(/[,\s]+/).filter(Boolean) : [...(views ?? [])];
  const ok = list.filter((v, i): v is ViewName => (ALL_VIEWS as readonly string[]).includes(v) && list.indexOf(v) === i);
  return ok.length ? ok : fallback;
}
