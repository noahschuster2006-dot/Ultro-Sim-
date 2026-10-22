import type { Ctx } from '../ctx';
import { eraCostFactor } from '../systems/finance';

/**
 * Where an action shows up in the phone UI.
 * - rel: per person (arg = npcId), listed when you select someone
 * - pet: per pet (arg = petId), listed when you select a pet
 * - romance: the Love app; family: People app "Family time";
 *   activity: the Going Out app; shop: the Shop app; pets: the Pets app;
 *   selfcare: the Health app
 */
export type ActionCat =
  | 'health'
  | 'mind'
  | 'lifestyle'
  | 'social'
  | 'rel'
  | 'career'
  | 'education'
  | 'skills'
  | 'crime'
  | 'legal'
  | 'prison'
  | 'assets'
  | 'politics'
  | 'media'
  | 'spirit'
  | 'estate'
  | 'romance'
  | 'family'
  | 'activity'
  | 'shop'
  | 'pets'
  | 'pet'
  | 'selfcare';

export interface ActionOption {
  value: string;
  label: string;
  disabled?: string;
}

export interface ActionDef {
  id: string;
  cat: ActionCat;
  label: string | ((x: Ctx, arg?: string) => string);
  desc?: string;
  /** Sub-heading inside an app, e.g. "Nightlife", "Outdoors". */
  group?: string;
  ap: number;
  /** true = usable, string = shown disabled with the reason, false = hidden. */
  avail?: (x: Ctx, arg?: string) => true | string | false;
  options?: (x: Ctx, arg?: string) => ActionOption[];
  /** Needs a numeric amount from the player. */
  amount?: boolean;
  /**
   * Background scene to play when the action succeeds (a scene id from
   * src/ui/scene/ids.ts). A function receives the chosen option value and the result text.
   */
  scene?: string | ((opt: string | undefined, result: string) => string | undefined);
  run: (x: Ctx, arg?: string, amount?: number) => string;
}

export const adult = (x: Ctx): true | string => (x.c.age >= 18 ? true : 'Adults only');
export const free = (x: Ctx): true | false => (x.c.legal.prison ? false : true);
export const freeAdult = (x: Ctx): true | string | false => (x.c.legal.prison ? false : adult(x));
export const price = (x: Ctx, n: number): number => Math.round(n * eraCostFactor(x.year));

export function moneyOk(x: Ctx, n: number): true | string {
  return x.c.money >= n ? true : `Costs ${x.fmt(n)}`;
}

/** The option part of a packed "npcId|option" argument. */
export function optOf(arg: string | undefined): string | undefined {
  if (!arg) return undefined;
  const parts = arg.split('|');
  return parts.length > 1 ? parts[1] : parts[0];
}

/** The target part (npc or pet id) of a packed "id|option" argument. */
export function targetOf(arg: string | undefined): string | undefined {
  return arg?.split('|')[0];
}
