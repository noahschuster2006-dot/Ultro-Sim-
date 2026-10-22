import type { Ctx } from '../ctx';
import { MENTAL_BY_ID } from '../data/conditions';
import { hashString } from '../rng';

export function hasCondition(x: Ctx, id: string): boolean {
  return x.c.mental.conditions.some((m) => m.id === id);
}

export function onset(x: Ctx, id: string, severity = 1): boolean {
  if (hasCondition(x, id)) return false;
  x.c.mental.conditions.push({ id, severity, onsetAge: x.age });
  const def = MENTAL_BY_ID[id];
  x.log(`🧠 You have developed ${def?.name ?? id}.`, 'bad');
  x.remember('mentalIllness', `Developed ${def?.name ?? id}`, 35);
  return true;
}

export function cure(x: Ctx, id: string): void {
  x.c.mental.conditions = x.c.mental.conditions.filter((m) => m.id !== id);
}

/** Apply a traumatic experience. Resilience softens it; violence risks PTSD. */
export function trauma(x: Ctx, amount: number, kind: 'violence' | 'loss' | 'abuse' | 'combat' | 'disaster' | 'betrayal' | 'ruin'): number {
  let a = amount * (1 - x.stat('resilience') / 200);
  if (x.c.traits.includes('resilient')) a *= 0.7;
  const d = x.mod('trauma', a);
  if (kind === 'loss' || kind === 'betrayal') x.mod('depression', a * 0.4);
  if (kind === 'ruin') x.mod('anxiety', a * 0.5);
  if ((kind === 'violence' || kind === 'combat' || kind === 'abuse' || kind === 'disaster') && x.stat('trauma') >= 60 && x.chance(0.35 + x.c.bio.predisposition.anxiety)) onset(x, 'ptsd');
  // Small chance trauma builds resilience instead.
  if (x.chance(0.2)) x.mod('resilience', 2);
  return d;
}

export function therapyAvailable(year: number): boolean {
  return year >= 1900;
}
export function medicationAvailable(year: number): boolean {
  return year >= 1955;
}
export function therapyCost(year: number): number {
  return year < 1950 ? 2500 : 6000;
}

/**
 * Yearly mental-health dynamics: cross-stat feedback, condition onset and
 * progression, and the differing effects of therapy, medication, faith and
 * support networks.
 */
export function mindTick(x: Ctx): void {
  const c = x.c;
  const m = c.mental;
  const s = (id: Parameters<Ctx['stat']>[0]) => x.stat(id);

  // Treatment costs and availability.
  if (m.therapy) {
    if (!therapyAvailable(x.year) || !x.spend(therapyCost(x.year))) {
      m.therapy = false;
      x.log('You stopped therapy.', 'neutral');
    }
  }
  if (m.medication) {
    if (!medicationAvailable(x.year) || !x.spend(1200)) {
      m.medication = false;
      x.log('You stopped taking psychiatric medication.', 'neutral');
    }
  }
  const friends = x.rels('bestFriend', 'friend', 'spouse', 'partner').filter((r) => r.affinity > 55).length;
  const faithCoping = s('faith') / 100;
  const support = Math.min(1, friends * 0.15 + (m.supportGroup ? 0.3 : 0));
  const treat = (m.therapy ? 0.35 : 0) + (m.medication ? 0.3 : 0) + faithCoping * 0.2 + support * 0.25;

  // Natural recovery scaled by treatment.
  x.mod('anxiety', -(1.5 + treat * 6));
  x.mod('depression', -(1 + treat * 6) * (hasCondition(x, 'depression') ? 0.5 : 1));
  x.mod('trauma', -(0.5 + treat * 5) * (m.therapy ? 1.5 : 1));
  x.mod('paranoia', -2);
  x.mod('stress', -(3 + treat * 3));
  const prevMania = (c.flags.lastMania as number) || 0;
  x.mod('mania', -9);
  if (prevMania > 60 && s('mania') < prevMania - 5) {
    x.mod('depression', 10);
    x.log('The manic high is over. You crash hard.', 'bad');
  }
  c.flags.lastMania = s('mania');

  // Cross-stat feedback loops.
  if (s('trauma') > 50 && !m.therapy) x.mods({ anxiety: 1.5, depression: 1.5 });
  if (s('loneliness') > 60) x.mod('depression', 1.5);
  if (s('stress') > 70) x.mods({ anxiety: 2, health: -1.5 });
  if (s('anxiety') > 50) x.mods({ happiness: -(s('anxiety') - 50) / 15, health: -0.5 });
  if (s('depression') > 40) x.mod('happiness', -(s('depression') - 40) / 12);
  if (s('fame') > 40) x.mod('ego', (s('fame') - 40) / 25);
  x.mod('ego', -1);
  if (s('mania') > 50) x.mods({ confidence: 3, riskTolerance: 2, creativity: 2 });
  if (c.age > 20) x.mod('wisdom', (c.age > 50 ? 0.7 : 0.3) * (x.blessing('wisdom') ? 2 : 1));
  if (c.age >= 65) for (const st of ['charisma', 'confidence'] as const) x.mod(st, 0.5);
  if (c.age >= 13) x.mod('loneliness', friends === 0 ? 3 : -friends * 1.5);
  // Happiness drifts toward a baseline set by circumstance.
  const baseline = 55 + (c.money > 50000 ? 5 : 0) + (x.partner() ? 6 : 0) + Math.min(10, friends * 2) - (c.legal.prison ? 20 : 0);
  x.mod('happiness', (baseline - s('happiness')) * 0.12 * (hasCondition(x, 'depression') ? 0.5 : 1));

  // Condition onset.
  const p = c.bio.predisposition;
  if (s('depression') >= 65 && x.chance(0.3 + p.depression)) onset(x, 'depression');
  if (s('anxiety') >= 65 && x.chance(0.3 + p.anxiety)) onset(x, 'anxietyDisorder');
  if (s('anxiety') >= 80 && x.chance(0.4)) onset(x, 'panic');
  if (s('mania') >= 70 && (hasCondition(x, 'depression') || c.mental.crises > 0) && x.chance(0.25 + p.bipolar)) onset(x, 'bipolar');
  if (s('paranoia') >= 85 && x.chance(0.35)) onset(x, 'psychosis');
  if (s('ego') >= 90 && x.chance(0.4)) onset(x, 'npd');
  if (s('stress') >= 75 && x.chance(0.25)) onset(x, 'insomnia');
  if (s('stress') >= 80 && c.career && x.chance(0.25)) onset(x, 'burnout');

  // Condition effects and recovery.
  for (const cond of [...m.conditions]) {
    switch (cond.id) {
      case 'depression':
        x.mods({ happiness: -3, energy: -2 });
        if (c.career) c.career.performance = Math.max(0, c.career.performance - 4);
        break;
      case 'anxietyDisorder':
        x.mods({ health: -1, anxiety: 2 });
        break;
      case 'panic':
        x.mod('anxiety', 2);
        break;
      case 'ptsd':
        x.mods({ anxiety: m.therapy ? 0 : 3, aggression: 1, energy: -1 });
        break;
      case 'bipolar':
        if (x.chance(m.medication ? 0.1 : 0.4)) {
          x.mod('mania', 35);
          x.log('A manic episode: you feel invincible, sleep two hours a night and spend wildly.', 'bad');
          x.money(-Math.min(Math.max(0, c.money), x.int(2000, 20000)));
        }
        break;
      case 'psychosis':
        x.mod('paranoia', m.medication ? -5 : 5);
        for (const r of c.relationships) r.trust = Math.max(0, r.trust - 2);
        break;
      case 'npd':
        for (const r of c.relationships) if (r.type !== 'parent') r.affinity = Math.max(0, r.affinity - 1);
        break;
      case 'insomnia':
        x.mods({ energy: -4, health: -1 });
        break;
      case 'grief':
        x.mod('depression', 3);
        break;
      case 'burnout':
        x.mods({ energy: -4, happiness: -2 });
        if (c.career) c.career.performance = Math.max(0, c.career.performance - 6);
        break;
    }
    const years = c.age - cond.onsetAge;
    const recoverP = cond.id === 'npd' ? treat * 0.08 : cond.id === 'grief' ? 0.25 + treat * 0.3 + (years > 2 ? 0.3 : 0) : cond.id === 'burnout' && !c.career ? 0.6 : treat * 0.3 + 0.03;
    if (x.chance(recoverP)) {
      cure(x, cond.id);
      x.log(`You have recovered from ${MENTAL_BY_ID[cond.id]?.name ?? cond.id}.`, 'good');
      x.mods({ happiness: 8, resilience: 3 });
    }
  }

  // Dementia (opt-in): cognitive decline narrows the world.
  if (m.dementiaStage > 0) {
    if (x.chance(0.4)) m.dementiaStage = Math.min(5, m.dementiaStage + 1);
    x.mods({ smarts: -3 * m.dementiaStage, wisdom: -1 });
  }
}

export interface DistortedChoices {
  visible: number[];
  notes: string[];
}

interface ChoiceLike {
  tags?: string[];
}

/**
 * Untreated mental-health conditions distort how choices are presented:
 * anxiety hides options, depression hides ambitious ones, mania pushes
 * impulsive ones, ego hides asking for help, dementia narrows everything.
 * Deterministic per event instance so re-rendering never reshuffles.
 */
export function distortChoices(x: Ctx, eventUid: string, choices: ChoiceLike[], available: number[]): DistortedChoices {
  const notes: string[] = [];
  if (available.length <= 1) return { visible: available, notes };
  let vis = [...available];
  const seed = hashString(`${x.s.seed}:${eventUid}`);
  const hideOne = (pred: (i: number) => boolean, note: string, salt: number) => {
    const cands = vis.filter(pred);
    if (!cands.length || vis.length <= 1) return;
    const victim = cands[(seed + salt) % cands.length];
    vis = vis.filter((i) => i !== victim);
    notes.push(note);
  };
  const treated = x.c.mental.therapy || x.c.mental.medication;
  const anx = x.stat('anxiety') - (treated ? 15 : 0);
  if (anx > 60) hideOne((i) => !choices[i].tags?.includes('cautious'), 'Your anxiety narrows what feels possible.', 1);
  if (anx > 80) hideOne((i) => !choices[i].tags?.includes('cautious'), 'Panic blots out another option.', 2);
  if (x.stat('depression') - (treated ? 15 : 0) > 70) hideOne((i) => !!choices[i].tags?.includes('ambitious'), 'Depression makes ambition feel pointless.', 3);
  if (x.stat('ego') > 80) hideOne((i) => !!choices[i].tags?.includes('help'), 'Your ego will not let you ask for help.', 4);
  if (x.stat('mania') > 60) hideOne((i) => !choices[i].tags?.includes('impulsive') && !!choices[i].tags?.includes('cautious'), 'Mania: caution feels unbearably boring.', 5);
  if (x.c.mental.dementiaStage >= 3) hideOne(() => true, 'The fog in your mind hides an option.', 6);
  if (x.c.mental.dementiaStage >= 4) hideOne(() => true, 'You struggle to follow the conversation.', 7);
  if (x.stat('paranoia') > 70) notes.push('Paranoia whispers that this is a trap.');
  if (x.stat('mania') > 60 && vis.some((i) => choices[i].tags?.includes('impulsive'))) notes.push('An impulsive option pulls at you.');
  return { visible: vis.length ? vis : [available[0]], notes };
}
