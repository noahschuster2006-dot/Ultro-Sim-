import type { Ctx } from '../ctx';
import type { Params } from '../types';

export type ChoiceTag = 'impulsive' | 'ambitious' | 'cautious' | 'violent' | 'help' | 'social';

export type EventCat =
  | 'romance'
  | 'family'
  | 'school'
  | 'work'
  | 'leisure'
  | 'pets'
  | 'possessions'
  | 'travel'
  | 'era'
  | 'birth'
  | 'childhood'
  | 'teen'
  | 'youngAdult'
  | 'adult'
  | 'midlife'
  | 'senior'
  | 'elder'
  | 'career'
  | 'crime'
  | 'legal'
  | 'relationship'
  | 'health'
  | 'mental'
  | 'spiritual'
  | 'media'
  | 'politics'
  | 'world'
  | 'assets'
  | 'dynasty'
  | 'secret'
  | 'chain';

export type Text = string | ((x: Ctx) => string);

export interface ChoiceDef {
  label: Text;
  hint?: Text;
  when?: (x: Ctx) => boolean;
  tags?: ChoiceTag[];
  /** Background scene for this outcome (a scene id from src/ui/scene/ids.ts). */
  scene?: string;
  run: (x: Ctx) => string | void;
}

export interface EventDef {
  id: string;
  cat: EventCat;
  title: Text;
  text: Text;
  minAge?: number;
  maxAge?: number;
  /** Inclusive year window. */
  years?: [number, number];
  weight?: number | ((x: Ctx) => number);
  once?: boolean;
  /** Minimum years between firings. Defaults to 3 for random events. */
  cooldown?: number;
  when?: (x: Ctx) => boolean;
  /** Bind parameters (e.g. pick an NPC). Returning null prevents the event. */
  bind?: (x: Ctx) => Params | null;
  choices?: ChoiceDef[];
  /** Effects for events without choices; returns outcome text. */
  auto?: (x: Ctx) => string | void;
  /** Weight multipliers when the character carries matching memories. */
  memory?: Record<string, number>;
  /** Only fires when explicitly queued by a system or chain. */
  triggered?: boolean;
  violent?: boolean;
  secret?: boolean;
  /** Allowed while imprisoned. Defaults to false for random events. */
  prison?: boolean;
  /**
   * Background scene that plays behind the phone when this event appears
   * (a scene id from src/ui/scene/ids.ts). The engine never reads it.
   */
  scene?: string;
}

export interface ChainDef {
  id: string;
  name: string;
  desc: string;
  steps: { delay: number; eventId: string }[];
}

export function textOf(t: Text | undefined, x: Ctx): string {
  if (t === undefined) return '';
  return typeof t === 'function' ? t(x) : t;
}
