export { newGame, SAVE_VERSION, type NewLifeOptions } from './systems/birth';
export { ageUp } from './sim';
export { currentEvent, choose, prepareQueue, EVENTS, CHAINS, ENGINE_ERRORS, type EventView } from './events/engine';
export { ACTIONS, viewActions, performAction, marketView, careerView, type ActionCat, type ActionView } from './actions';
export { continueAs, heirCandidates, DYNASTY_MILESTONES } from './systems/dynasty';
export { Ctx, fmtMoney, fmtYear, lifeStage, STAGE_NAMES } from './ctx';
export type * from './types';

import type { GameState } from './types';
import { SAVE_VERSION } from './systems/birth';

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

/** Fill in fields added after a save was written, so older saves keep working. */
function migrate(s: GameState): void {
  s.char.pets ??= [];
  s.char.items ??= [];
}

export function deserialize(json: string): GameState | null {
  try {
    const s = JSON.parse(json) as GameState;
    if (!s || s.version !== SAVE_VERSION || !s.char || !s.world) return null;
    migrate(s);
    return s;
  } catch {
    return null;
  }
}
