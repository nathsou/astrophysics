/** Shapes of the history data in content/{timeline,lineage,museum,bios}.yaml (+ .d/*.yaml). */

export const LANES = ['logic', 'model-checking', 'sat', 'smt', 'deductive', 'heap', 'abstract-interpretation', 'industry', 'disasters'] as const;
export type Lane = (typeof LANES)[number];

export const LANE_LABELS: Record<Lane, string> = {
  logic: 'Logic and computability',
  'model-checking': 'Model checking',
  sat: 'SAT and BDDs',
  smt: 'SMT and symbolic execution',
  deductive: 'Deductive verification',
  heap: 'Heap and separation logic',
  'abstract-interpretation': 'Abstract interpretation',
  industry: 'Industrial adoption',
  disasters: 'Failures and disasters',
};

/** Part each lane mostly belongs to, for the `part` filter. */
export const LANE_PARTS: Record<Lane, string[]> = {
  logic: ['II', 'III'],
  'model-checking': ['I', 'II', 'V'],
  sat: ['II'],
  smt: ['III'],
  deductive: ['IV', 'V'],
  heap: ['IV'],
  'abstract-interpretation': ['VI'],
  industry: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'],
  disasters: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'],
};

export interface TimelineEvent {
  year: number;
  month?: number;
  lane: Lane;
  title: string;
  people?: string;
  /** Chapter (or part essay) slug where the event matters. */
  chapter?: string;
  /** Part ids this event belongs to (defaults from the lane). */
  parts?: string[];
  /** HTML (rendered at build time). */
  text: string;
  cite?: string[];
}

export interface LineageNode {
  id: string;
  name: string;
  year: number;
  kind: 'tool' | 'idea' | 'paper';
  lane: Lane;
  chapter?: string;
  /** Anchor in the Rosetta appendix, when the tool appears there. */
  rosetta?: string;
  note?: string;
}

export interface LineageEdge {
  from: string;
  to: string;
  type: 'descends' | 'influenced';
  cite?: string[];
}

export interface Exhibit {
  id: string;
  title: string;
  year: number | string;
  /** HTML. */
  summary: string;
  chapter: string;
  reenacted: boolean;
  simplification?: string;
  cite?: string[];
}

export interface BioEntry {
  id: string;
  name: string;
  born?: number;
  died?: number;
  summary: string;
  chapters?: string[];
  cite?: string[];
}
