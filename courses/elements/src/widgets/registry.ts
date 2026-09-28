// Widgets that the modern texts can embed with `::name{props}` on a line of their own.
// Every file src/widgets/**/<name>.widget.tsx is a widget called <name>; its default export is
// a React component receiving the props as strings. Widgets are loaded when first shown.

import { lazy, type ComponentType } from 'react';

type W = ComponentType<Record<string, string>>;

const modules = import.meta.glob('./**/*.widget.tsx', { import: 'default' }) as Record<string, () => Promise<W>>;

export const widgets: Record<string, W> = {};
/** Widget names defined twice (the first one wins; the tests fail on this). */
export const duplicateWidgets: string[] = [];
for (const [path, load] of Object.entries(modules)) {
  const name = /([\w-]+)\.widget\.tsx$/.exec(path)![1];
  if (widgets[name]) {
    duplicateWidgets.push(`${name} (${path})`);
    console.error(`Two widgets are called ${name}`);
    continue;
  }
  widgets[name] = lazy(async () => ({ default: await load() })) as unknown as W;
}
