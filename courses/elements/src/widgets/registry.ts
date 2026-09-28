// Widgets that the modern texts can embed with `::name{props}` on a line of their own.
import type { ComponentType } from 'react';
import { lazy } from 'react';

type W = ComponentType<Record<string, string>>;
const l = (f: () => Promise<{ default: W }>): W => lazy(f) as unknown as W;

export const widgets: Record<string, W> = {};
export const registerWidget = (name: string, loader: () => Promise<{ default: W }>) => {
  widgets[name] = l(loader);
};
