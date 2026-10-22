import { Ctx } from './ctx';
import type { GameState } from './types';
import { worldTick } from './systems/world';
import { bodyTick } from './systems/body';
import { mindTick } from './systems/mind';
import { addictionTick } from './systems/addiction';
import { educationTick } from './systems/education';
import { careerTick } from './systems/careers';
import { skillTick } from './systems/skills';
import { birthChild, relationshipsTick } from './systems/relationships';
import { npcTick } from './systems/npcs';
import { legalTick } from './systems/legal';
import { underworldTick } from './systems/underworld';
import { assetsTick } from './systems/assets';
import { mediaTick } from './systems/media';
import { spiritTick } from './systems/spirit';
import { politicsTick } from './systems/politics';
import { financeTick, statsTick } from './systems/finance';
import { checkDeath, die } from './systems/dynasty';
import { apMaxFor } from './systems/birth';
import { possessionsTick } from './systems/possessions';
import { chainTick, prepareQueue, rollYearEvents } from './events/engine';

const CLOSE = new Set(['parent', 'sibling', 'child', 'spouse', 'partner', 'bestFriend', 'grandparent', 'grandchild', 'mentor', 'protege']);

export interface AgeUpResult {
  ok: boolean;
  reason?: string;
}

/**
 * Advance one year. The world ticks first, then every life system, then
 * consequence chains and random events, then mortality.
 */
export function ageUp(s: GameState): AgeUpResult {
  if (s.phase !== 'alive') return { ok: false, reason: 'This life is over.' };
  prepareQueue(s);
  if (s.queue.length) return { ok: false, reason: 'Resolve the pending event first.' };
  const x = new Ctx(s);
  const c = s.char;
  s.recent = [];
  s.world.year++;
  c.age++;

  worldTick(x);

  // Family arrivals.
  if (c.flags.youngerSiblingDue && c.age === c.flags.youngerSiblingDue && x.aliveParents().length === 2) x.queue('younger_sibling');
  if (c.flags.pregnantDue && c.age >= (c.flags.pregnantDue as number)) {
    const other = c.flags.babyOther as string | undefined;
    delete c.flags.pregnantDue;
    delete c.flags.babyOther;
    if (!other || x.npc(other)?.alive) {
      const kid = birthChild(x, other);
      if (c.flags.geneEdited) {
        kid.smarts = Math.min(100, kid.smarts + 15);
        kid.health = Math.min(100, kid.health + 10);
      }
      x.log(`👶 ${kid.firstName} was born!`, 'major');
    }
  }

  bodyTick(x);
  mindTick(x);
  addictionTick(x);
  for (const line of educationTick(x)) x.log(line, line.startsWith('🎓') ? 'good' : 'neutral');
  careerTick(x);
  skillTick(x);
  relationshipsTick(x);

  // NPC autonomy and the news it generates.
  for (const n of npcTick(x)) {
    const r = x.rel(n.npcId);
    if (n.kind === 'death') {
      if (r && CLOSE.has(r.type)) {
        x.queue('npc_death', { npcId: n.npcId });
        if (r.type === 'parent') {
          const npc = x.npc(n.npcId)!;
          const otherAlive = npc.spouseId && x.npc(npc.spouseId)?.alive;
          const heirs = Math.max(1, npc.childIds.filter((id) => id === c.id || x.npc(id)?.alive).length);
          const amount = Math.round((Math.max(0, npc.wealth) * (otherAlive ? 0.1 : 0.7)) / heirs);
          if (amount > 0) x.queue('parent_inheritance', { npcId: n.npcId, amount });
        }
      } else if (r && ['enemy', 'nemesis', 'rival', 'bully'].includes(r.type)) {
        x.log(`${n.text} Your old enemy is gone.`, 'neutral');
        x.mods({ happiness: 2, paranoia: -3 });
      } else {
        x.log(n.text, 'neutral');
      }
    } else {
      x.log(n.text, n.kind === 'fall' || n.kind === 'crime' ? 'bad' : 'neutral');
    }
  }

  legalTick(x);
  underworldTick(x);
  assetsTick(x);
  possessionsTick(x);
  mediaTick(x);
  spiritTick(x);
  politicsTick(x);
  financeTick(x);
  statsTick(x);
  if (c.money < 0) {
    c.debt += -c.money;
    c.money = 0;
  }

  // Mortality before this year's events.
  const death = checkDeath(x);
  if (death) {
    die(x, death.cause, death.type);
    return { ok: true };
  }

  chainTick(x);
  rollYearEvents(x);

  c.apMax = apMaxFor(c);
  c.ap = c.apMax;
  prepareQueue(s);
  if (c.log.length > 3000) c.log.splice(0, c.log.length - 3000);
  return { ok: true };
}
