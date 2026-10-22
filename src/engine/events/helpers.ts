import type { Ctx } from '../ctx';
import type { RelType } from '../types';

export function relOf(x: Ctx, ...types: RelType[]): string | undefined {
  const r = x.rels(...types);
  return r.length ? x.pick(r).npcId : undefined;
}

export function bindRel(...types: RelType[]) {
  return (x: Ctx) => {
    const id = relOf(x, ...types);
    return id ? { npcId: id } : null;
  };
}

/** The NPC id bound to the current event. */
export function npcId(x: Ctx): string {
  return x.p.npcId as string;
}

export function who(x: Ctx): string {
  return x.first(npcId(x));
}

export function whoFull(x: Ctx): string {
  return x.name(npcId(x));
}

export function has(x: Ctx, ...types: RelType[]): boolean {
  return x.rels(...types).length > 0;
}

export function poor(x: Ctx): boolean {
  return ['destitute', 'poor'].includes(x.c.familyStatus);
}

export function rich(x: Ctx): boolean {
  return ['wealthy', 'aristocracy', 'royalty'].includes(x.c.familyStatus);
}

export function modern(x: Ctx, from = 1950): boolean {
  return x.year >= from;
}

/** Simple stat check with a little luck. */
export function check(x: Ctx, value: number, difficulty: number): boolean {
  return x.chance(Math.max(0.05, Math.min(0.95, 0.5 + (value - difficulty) / 100)));
}
