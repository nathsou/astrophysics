import type { ComponentProps, ReactNode } from 'react';
import { Aside, Callout, Figure, Kbd, Term, Tip } from './prose';
import * as viz from '../viz';
import { ErrorBoundary } from './ErrorBoundary';
import { Pre } from './Highlight';
import type { ComponentType } from 'react';

/** Every widget gets its own error boundary so one failure never blanks a chapter. */
function guarded<P extends object>(name: string, C: ComponentType<P>): ComponentType<P> {
  const G = (p: P) => (
    <ErrorBoundary label={name}>
      <C {...p} />
    </ErrorBoundary>
  );
  G.displayName = `Guarded(${name})`;
  return G;
}
const widgets = Object.fromEntries(Object.entries(viz).map(([k, v]) => [k, guarded(k, v as ComponentType<object>)]));

function slugify(children: ReactNode): string {
  const text = typeof children === 'string' ? children : Array.isArray(children) ? children.map((c) => (typeof c === 'string' ? c : '')).join('') : '';
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function H2(p: ComponentProps<'h2'>) {
  const id = slugify(p.children);
  return (
    <h2 id={id} {...p}>
      {p.children}
      <a className="anchor" href={`${window.location.hash.split('#').slice(0, 2).join('#')}#${id}`} aria-label="link to section">#</a>
    </h2>
  );
}
function H3(p: ComponentProps<'h3'>) {
  return <h3 id={slugify(p.children)} {...p} />;
}
function A(p: ComponentProps<'a'>) {
  const ext = p.href?.startsWith('http');
  return <a {...p} target={ext ? '_blank' : undefined} rel={ext ? 'noreferrer' : undefined} />;
}

export const mdxComponents = {
  h2: H2,
  h3: H3,
  a: A,
  pre: Pre,
  Aside,
  Callout,
  Figure,
  Term,
  Tip,
  Kbd,
  ...widgets,
};
