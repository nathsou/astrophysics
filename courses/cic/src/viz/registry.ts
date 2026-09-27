// Widgets available in chapters. Heavy widgets are loaded lazily.
import { lazy } from 'solid-js';
import { Exercise } from './Exercise.tsx';
import { CourseMap } from './CourseMap.tsx';
import { DerivationView } from './DerivationView.tsx';

const lz = <T,>(f: () => Promise<Record<string, T>>, name: string) => lazy(() => f().then((m) => ({ default: m[name] as never })));

export const widgets: Record<string, unknown> = {
  Exercise,
  CourseMap,
  DerivationView,
  LambdaLab: lz(() => import('./lambda/LambdaLab.tsx'), 'LambdaLab'),
  BinderLab: lz(() => import('./binders/BinderLab.tsx'), 'BinderLab'),
  SubstLab: lz(() => import('./binders/BinderLab.tsx'), 'SubstLab'),
  CoreTermView: lz(() => import('./binders/CoreTermView.tsx'), 'CoreTermView'),
  ProofBuilder: lz(() => import('./logic/ProofBuilder.tsx'), 'ProofBuilder'),
  CubeViz: lz(() => import('./cube/CubeViz.tsx'), 'CubeViz'),
  UniverseLab: lz(() => import('./universes/UniverseLab.tsx'), 'UniverseLab'),
  RecursorView: lz(() => import('./inductive/RecursorView.tsx'), 'RecursorView'),
  PositivityLab: lz(() => import('./inductive/PositivityLab.tsx'), 'PositivityLab'),
  CompileView: lz(() => import('./inductive/CompileView.tsx'), 'CompileView'),
  KernelTrace: lz(() => import('./kernel/KernelTrace.tsx'), 'KernelTrace'),
  CodeSize: lz(() => import('./kernel/CodeSize.tsx'), 'CodeSize'),
  BreakIt: lz(() => import('./kernel/BreakIt.tsx'), 'BreakIt'),
};
