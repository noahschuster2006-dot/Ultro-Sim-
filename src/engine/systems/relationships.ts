import type { Ctx } from '../ctx';
import type { NPC, Relationship, Upbringing } from '../types';
import { linkNpcs, makeNpc } from './npcs';
import { trauma, onset } from './mind';
import { normal } from '../rng';

const FAMILY = new Set(['parent', 'sibling', 'child', 'grandchild', 'grandparent']);

export function attractedTo(x: Ctx, npc: NPC): boolean {
  const c = x.c;
  const sx = c.sexuality;
  if (sx === 'asexual') return false;
  if (sx === 'bisexual') return true;
  const same = npc.gender === c.gender;
  return sx === 'gay' ? same : !same;
}

export function compatibility(x: Ctx, npc: NPC): number {
  const c = x.c;
  const diff = Math.abs(x.stat('smarts') - npc.smarts) / 2 + Math.abs(x.stat('karma') - npc.karma) / 4 + Math.abs(x.stat('aggression') - npc.aggression) / 3;
  const faith = c.religionId === npc.religionId ? 8 : 0;
  return Math.max(0, Math.min(100, Math.round(85 - diff + faith)));
}

export function attraction(x: Ctx, npc: NPC): number {
  return Math.max(0, Math.min(100, Math.round(npc.looks * 0.6 + x.stat('looks') * 0.2 + x.stat('charisma') * 0.2 + normal(x.s, 0, 8))));
}

/** Generate three romantic candidates and queue the choice. */
export function findLove(x: Ctx, via: 'social' | 'app' | 'arranged' = 'social'): string {
  const c = x.c;
  if (c.age < 14) return 'You are too young.';
  if (c.sexuality === 'asexual' && via !== 'arranged') return 'You are not looking for romance.';
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    let gender = c.gender === 'male' ? 'female' : 'male';
    if (c.sexuality === 'gay') gender = c.gender === 'nonbinary' ? x.pick(['male', 'female']) : c.gender;
    if (c.sexuality === 'bisexual') gender = x.pick(['male', 'female']);
    const wealthy = via === 'arranged' && ['aristocracy', 'royalty', 'wealthy'].includes(c.familyStatus);
    const npc = makeNpc(x, {
      gender: gender as NPC['gender'],
      age: Math.max(c.age < 18 ? 14 : 18, c.age + x.int(-5, 5)),
      sexuality: c.sexuality === 'straight' || c.sexuality === 'asexual' ? 'straight' : c.sexuality,
      wealth: wealthy ? x.int(500000, 20000000) : undefined,
    });
    if (wealthy) npc.notes.push('From a powerful family');
    ids.push(npc.id);
  }
  x.queue('romance_candidates', { a: ids[0], b: ids[1], c: ids[2], via }, true);
  return via === 'arranged' ? 'Your family has arranged introductions.' : 'You put yourself out there.';
}

export function startDating(x: Ctx, npcId: string): string {
  const npc = x.npc(npcId);
  if (!npc) return 'They are gone.';
  const att = attraction(x, npc);
  const comp = compatibility(x, npc);
  const p = 0.3 + att / 300 + x.stat('charisma') / 300 + x.skill('seduction') / 300 - x.stat('romanticCynicism') / 300;
  if (!x.chance(Math.min(0.9, p))) {
    x.mods({ happiness: -3, confidence: -2 });
    return `${npc.firstName} was not interested.`;
  }
  const hasPartner = x.partner();
  const r = x.addRel(npcId, hasPartner ? 'affair' : 'partner', { affinity: 55 + att / 5, trust: 50, attraction: att, compatibility: comp, meta: { discretion: 50 } });
  x.mods({ happiness: 8, loneliness: -10 });
  x.train('charm', 2);
  if (npc.gender === x.c.gender && x.w.socialNorms < 45) {
    x.secret(`samesex_${npcId}`, `A same-sex relationship with ${x.name(npc)}`, x.w.socialNorms < 30 ? 6 : 3);
    if (x.chance(0.25)) x.queue('lgbt_consequence', { npcId });
  }
  if (r.type === 'affair') {
    x.secret(`affair_${npcId}`, `An affair with ${x.name(npc)}`, 5);
    x.mods({ karma: -4, sin: 3 });
    return `You began a secret affair with ${npc.firstName}.`;
  }
  x.remember('romance', `Started dating ${x.name(npc)}`, 15, npcId);
  return `You and ${npc.firstName} are now dating.`;
}

export function propose(x: Ctx, npcId: string): string {
  const r = x.rel(npcId);
  const npc = x.npc(npcId);
  if (!r || !npc || r.type !== 'partner') return 'You can only propose to your partner.';
  if (x.c.age < 16) return 'You are too young to marry.';
  if (x.spouse()) return 'You are already married.';
  const p = (r.affinity + r.compatibility) / 200 + (r.history > 3 ? 0.1 : 0) - x.stat('romanticCynicism') / 400;
  if (!x.chance(Math.min(0.92, p))) {
    r.affinity = Math.max(0, r.affinity - 15);
    x.mods({ happiness: -12, romanticCynicism: 6 });
    return `${npc.firstName} said no.`;
  }
  x.queue('wedding', { npcId }, true);
  return `${npc.firstName} said yes!`;
}

/** Marriage: joint finances, in-laws, and you inherit their family's enemies. */
export function marry(x: Ctx, npcId: string, opts: { prenup: boolean; lavish: boolean }): string {
  const c = x.c;
  const npc = x.npc(npcId)!;
  const r = x.rel(npcId)!;
  const cost = opts.lavish ? 60000 : 8000;
  if (!x.spend(cost)) x.c.debt += cost;
  r.type = 'spouse';
  r.affinity = Math.min(100, r.affinity + 10);
  r.meta.prenup = opts.prenup;
  r.meta.marriedAge = c.age;
  npc.spouseId = c.id;
  x.mods({ happiness: 15, loneliness: -20 });
  if (opts.lavish) x.mod('fame', 2);
  x.remember('married', `Married ${x.name(npc)}`, 45, npcId);
  // In-laws.
  const inlaw = makeNpc(x, { age: x.npcAge(npc) + x.int(22, 34), lastName: npc.lastName, countryId: npc.countryId });
  linkNpcs(x, inlaw.id, npc.id, 'family');
  x.addRel(inlaw.id, 'inLaw', { affinity: x.int(30, 70), trust: 45 });
  if (npc.wealth > 1000000) x.money(Math.round(npc.wealth * 0.1));
  // Inherit enemies of the family you married into.
  let inherited = 0;
  for (const l of [...npc.links, ...inlaw.links]) {
    if (l.kind === 'enemy' && x.npc(l.npcId)?.alive && !x.rel(l.npcId)) {
      x.addRel(l.npcId, 'rival', { affinity: 20, trust: 10, meta: { inherited: true } });
      inherited++;
    }
  }
  if (x.chance(0.25) && !inherited) {
    const feud = makeNpc(x, { age: x.int(30, 60), karma: -20, aggression: 55 });
    linkNpcs(x, feud.id, inlaw.id, 'enemy');
    x.addRel(feud.id, 'rival', { affinity: 20, trust: 10, meta: { inherited: true } });
    inherited++;
  }
  return `You married ${npc.firstName}${opts.prenup ? ' (with a prenup)' : ''}.${inherited ? ` Marrying into the ${npc.lastName} family brought along their old enemies.` : ''}`;
}

export function divorce(x: Ctx, npcId: string): string {
  const c = x.c;
  const r = x.rel(npcId);
  if (!r || r.type !== 'spouse') return 'You are not married to them.';
  const npc = x.npc(npcId)!;
  r.type = 'ex';
  r.affinity = Math.min(r.affinity, 25);
  npc.spouseId = undefined;
  let text = `You divorced ${npc.firstName}.`;
  if (!r.meta.prenup) {
    const split = Math.round(Math.max(0, c.money) * 0.5);
    c.money -= split;
    for (const a of c.assets) if (a.typeId === 'house' && x.chance(0.5)) a.value = Math.round(a.value * 0.5);
    text += ` The settlement cost you ${x.fmt(split)}.`;
  } else text += ' The prenup protected your assets.';
  const kids = x.rels('child').filter((k) => x.npcAge(x.npc(k.npcId)!) < 18);
  if (kids.length) {
    const custody = x.chance(0.4 + x.stat('professionalRep') / 300 - (c.legal.record.length ? 0.2 : 0));
    for (const k of kids) k.affinity = Math.max(0, k.affinity - (custody ? 5 : 20));
    c.flags.childSupport = custody ? 0 : kids.length * 9000;
    text += custody ? ' You won primary custody.' : ' Your ex won custody; you pay child support.';
  }
  x.mods({ happiness: -12, romanticCynicism: 8, stress: 10 });
  trauma(x, 6, 'loss');
  x.remember('divorced', `Divorced ${x.name(npc)}`, 35, npcId);
  return text;
}

export function breakUp(x: Ctx, npcId: string): string {
  const r = x.rel(npcId);
  if (!r) return 'Nothing to end.';
  r.type = 'ex';
  r.affinity = Math.min(r.affinity, 30);
  x.mods({ happiness: -5, romanticCynicism: 4 });
  return `You broke up with ${x.first(npcId)}.`;
}

export function canConceive(x: Ctx): true | string {
  const c = x.c;
  const p = x.partner();
  if (!p) return 'You need a partner';
  const npc = x.npc(p.npcId)!;
  if (npc.gender === c.gender) return 'You will need to adopt or find a surrogate';
  if (x.curse('infertility') && x.stat('divineFavor') < 50) return 'The infertility curse lies on your bloodline';
  const femaleAge = c.gender === 'female' ? c.age : x.npcAge(npc);
  if (femaleAge > 50) return 'Too old to conceive';
  if (c.flags.pregnantDue) return 'A baby is already on the way';
  return true;
}

export function tryForBaby(x: Ctx): string {
  const ok = canConceive(x);
  if (ok !== true) return ok;
  const c = x.c;
  const p = x.partner()!;
  const fert = x.stat('fertility') / 100;
  const blessing = x.blessing('fertility') ? 0.25 : 0;
  if (x.chance(Math.min(0.9, fert * 0.7 + blessing))) {
    c.flags.pregnantDue = c.age + 1;
    c.flags.babyOther = p.npcId;
    return c.gender === 'female' ? "You're pregnant!" : `${x.first(p.npcId)} is pregnant!`;
  }
  return 'No luck this year.';
}

export function adopt(x: Ctx): string {
  const c = x.c;
  const cost = x.year >= 1950 ? 25000 : 2000;
  if (c.age < 21) return 'You must be 21 to adopt.';
  if (!x.spend(cost)) return `Adoption costs ${x.fmt(cost)}.`;
  const kid = makeNpc(x, { age: x.int(0, 9), career: null, lastName: c.lastName, dynasty: true });
  kid.parentIds = [c.id];
  kid.upbringing = 'balanced';
  x.addRel(kid.id, 'child', { affinity: 55, trust: 50, meta: { adopted: true } });
  x.mods({ happiness: 12, karma: 6 });
  x.remember('adopted', `Adopted ${kid.firstName}`, 40, kid.id);
  return `You adopted ${kid.firstName}, age ${x.npcAge(kid)}.`;
}

/** A child is born: blend of parent stats with variance, plus inherited traits. */
export function birthChild(x: Ctx, otherId?: string): NPC {
  const c = x.c;
  const other = x.npc(otherId);
  const gender = x.chance(0.5) ? 'male' : 'female';
  const kid = makeNpc(x, {
    gender,
    age: 0,
    career: null,
    lastName: c.gender === 'male' || !other ? c.lastName : x.s.dynasty.name === c.lastName ? c.lastName : other.lastName,
    smarts: (x.stat('smarts') + (other?.smarts ?? 50)) / 2 + normal(x.s, 0, 10),
    looks: (x.stat('looks') + (other?.looks ?? 50)) / 2 + normal(x.s, 0, 10),
    dynasty: true,
    parentIds: other ? [c.id, other.id] : [c.id],
    karma: 0,
  });
  kid.heightCm = Math.round((c.bio.heightCm + (other ? (other.gender === 'male' ? 177 : 164) : c.bio.heightCm)) / 2 + (gender === 'male' ? 6 : -6) + normal(x.s, 0, 5));
  const pool = c.traits.length ? c.traits : x.s.dynasty.traitPool;
  kid.inherited = { traits: pool.filter(() => x.chance(0.45)).slice(0, 5), predisposition: { ...c.bio.predisposition } };
  kid.upbringing = 'balanced';
  kid.favor = 0;
  if (other) {
    other.childIds.push(kid.id);
    linkNpcs(x, other.id, kid.id, 'family');
  }
  x.addRel(kid.id, 'child', { affinity: 80, trust: 80 });
  x.mods({ happiness: 15, stress: 6 });
  x.remember('childBorn', `${kid.firstName} was born`, 45, kid.id);
  return kid;
}

export function setUpbringing(x: Ctx, npcId: string, focus: Upbringing): string {
  const npc = x.npc(npcId);
  if (!npc) return 'No such child.';
  npc.upbringing = focus;
  return `You will raise ${npc.firstName} with a ${focus} focus.`;
}

export function spendTime(x: Ctx, npcId: string): string {
  const r = x.rel(npcId);
  const npc = x.npc(npcId);
  if (!r || !npc) return 'They are not around.';
  const gain = x.int(4, 12) + (r.type === 'child' ? 4 : 0);
  r.affinity = Math.min(100, r.affinity + gain);
  r.trust = Math.min(100, r.trust + 2);
  r.history++;
  if (r.type === 'child') npc.favor = (npc.favor ?? 0) + 1;
  x.mods({ happiness: 3, loneliness: -4, stress: -2 });
  return `You spent quality time with ${npc.firstName}.`;
}

export function giveGift(x: Ctx, npcId: string, amount: number): string {
  const r = x.rel(npcId);
  const npc = x.npc(npcId);
  if (!r || !npc) return 'They are not around.';
  if (!x.spend(amount)) return 'You cannot afford that.';
  npc.wealth += amount;
  const gain = Math.min(25, 3 + Math.log10(Math.max(10, amount)) * 3);
  r.affinity = Math.min(100, r.affinity + gain);
  if (r.type === 'child') npc.favor = (npc.favor ?? 0) + 2;
  return `${npc.firstName} loved the gift.`;
}

export function argue(x: Ctx, npcId: string): string {
  const r = x.rel(npcId);
  if (!r) return 'They are not around.';
  r.affinity = Math.max(0, r.affinity - x.int(8, 18));
  r.trust = Math.max(0, r.trust - 5);
  x.mods({ stress: 3, aggression: 1 });
  if (r.affinity < 15 && !FAMILY.has(r.type) && r.type !== 'spouse') {
    r.type = r.affinity < 5 ? 'nemesis' : 'enemy';
    return `Your feud with ${x.first(npcId)} is now open warfare.`;
  }
  return `You had a nasty argument with ${x.first(npcId)}.`;
}

export function reconcile(x: Ctx, npcId: string): string {
  const r = x.rel(npcId);
  if (!r) return 'They are not around.';
  const p = 0.3 + x.stat('empathy') / 250 + x.skill('conflictResolution') / 200 + (x.stat('wisdom') > 50 ? 0.1 : 0);
  if (x.chance(p)) {
    r.affinity = Math.max(r.affinity, 45);
    r.trust = Math.min(100, r.trust + 10);
    if (['enemy', 'nemesis', 'rival'].includes(r.type)) r.type = 'acquaintance';
    x.mods({ karma: 5, happiness: 5 });
    x.remember('reconciled', `Reconciled with ${x.name(npcId)}`, 30, npcId);
    return `You and ${x.first(npcId)} made peace.`;
  }
  return `${x.first(npcId)} is not ready to forgive you.`;
}

export function askForMoney(x: Ctx, npcId: string): string {
  const r = x.rel(npcId);
  const npc = x.npc(npcId);
  if (!r || !npc) return 'They are not around.';
  if (npc.wealth < 500 || !x.chance(r.affinity / 140)) {
    r.affinity = Math.max(0, r.affinity - 5);
    return `${npc.firstName} said no.`;
  }
  const amt = Math.round(Math.min(npc.wealth * 0.1, x.int(100, 5000) * (1 + npc.wealth / 200000)));
  npc.wealth -= amt;
  x.money(amt);
  r.affinity = Math.max(0, r.affinity - 4);
  if (amt > 10000) {
    r.type = r.type === 'friend' ? 'debtHolder' : r.type;
    r.meta.debt = amt;
  }
  return `${npc.firstName} gave you ${x.fmt(amt)}.`;
}

export function befriend(x: Ctx): string {
  const npc = makeNpc(x, { age: Math.max(6, x.age + x.int(-4, 4)) });
  x.addRel(npc.id, 'friend', { affinity: 50 + x.int(0, 20), trust: 45 });
  x.mod('loneliness', -6);
  return `You made a new friend: ${npc.firstName} ${npc.lastName}.`;
}

export function findMentor(x: Ctx): string {
  if (x.rels('mentor').length) return 'You already have a mentor.';
  const career = x.c.career?.careerId;
  const npc = makeNpc(x, { age: x.age + x.int(15, 35), career: career ?? undefined, careerLevel: 8 });
  x.addRel(npc.id, 'mentor', { affinity: 55, trust: 55 });
  x.remember('mentor', `Found a mentor in ${x.name(npc)}`, 25, npc.id);
  return `${npc.firstName} ${npc.lastName} agreed to mentor you.`;
}

export function takeProtege(x: Ctx): string {
  if (x.c.age < 35) return 'You need more experience before taking a protégé.';
  if (x.rels('protege').length >= 2) return 'You already have protégés.';
  const npc = makeNpc(x, { age: x.int(18, 26), career: x.c.career?.careerId ?? null, careerLevel: 1 });
  x.addRel(npc.id, 'protege', { affinity: 60, trust: 55 });
  x.train('mentoring', 4);
  return `You took ${npc.firstName} ${npc.lastName} under your wing.`;
}

/**
 * Yearly relationship dynamics: drift, upbringing, neglect, jealousy,
 * betrayal and nemesis escalation. Betrayal probability rises when you hold
 * power over someone, they are in debt, your karma is low, or a rival bids.
 */
export function relationshipsTick(x: Ctx): void {
  const c = x.c;
  for (const r of c.relationships) {
    const npc = x.npc(r.npcId);
    if (!npc?.alive) continue;
    // Family settles toward ~50 without effort; other bonds fade unless tended.
    if (FAMILY.has(r.type) || r.type === 'spouse') r.affinity += (60 - r.affinity) * 0.05 - 0.5;
    else if (['friend', 'bestFriend', 'partner', 'mentor', 'protege', 'colleague', 'acquaintance', 'businessPartner'].includes(r.type)) r.affinity -= 1.5;
    r.affinity = Math.max(0, Math.min(100, r.affinity));
    if (r.type === 'friend' && r.affinity > 85 && r.history > 4 && !x.rels('bestFriend').length) r.type = 'bestFriend';
    if ((r.type === 'friend' || r.type === 'acquaintance' || r.type === 'colleague') && r.affinity < 10) r.type = 'acquaintance';
  }
  // Children growing up.
  for (const r of x.rels('child')) {
    const kid = x.npc(r.npcId)!;
    const age = x.npcAge(kid);
    if (age < 18) {
      const focus = kid.upbringing ?? 'balanced';
      if (r.affinity < 30 && age > 5) kid.upbringing = 'neglected';
      if (focus === 'academic') kid.smarts = Math.min(100, kid.smarts + 1.5);
      if (focus === 'athletic') kid.health = Math.min(100, kid.health + 1);
      if (focus === 'criminal') {
        kid.criminal = Math.min(100, (kid.criminal ?? 0) + 4);
        kid.karma -= 2;
      }
      if (focus === 'spiritual') kid.karma += 1.5;
      if (focus === 'neglected') {
        kid.karma -= 1;
        kid.aggression = Math.min(100, kid.aggression + 1);
      }
      if (age >= 6 && age < 18 && !kid.education.includes('primary') && age === 12) kid.education.push('primary');
      if (age === 17) kid.education.push('secondary');
      if (c.age >= 18 && !c.legal.prison) {
        const childCost = x.year >= 1950 ? 9000 : 3000;
        if (!x.spend(childCost)) x.mod('stress', 3);
      }
    } else if (age === 18 || age === 19) {
      if (r.affinity < 20 && x.chance(0.4)) {
        r.type = 'enemy';
        x.log(`💔 ${kid.firstName} has cut you out of their life. A neglected childhood left its mark.`, 'bad');
        x.remember('estrangedChild', `${kid.firstName} became estranged`, 40, kid.id);
      }
    }
  }
  // Partner dynamics.
  const p = x.partner();
  if (p) {
    const affairs = x.rels('affair');
    for (const a of affairs) {
      const discretion = (a.meta.discretion as number) ?? 50;
      const discoverP = (0.12 + (100 - discretion) / 400) * (x.stat('fame') > 40 ? 1.5 : 1);
      if (x.chance(discoverP) && !x.queued('affair_discovered')) x.queue('affair_discovered', { spouse: p.npcId, lover: a.npcId });
    }
    if (p.affinity < 20 && p.type === 'spouse' && x.chance(0.25) && !x.queued('spouse_divorce')) x.queue('spouse_divorce', { npcId: p.npcId });
    if (p.affinity < 15 && p.type === 'partner' && x.chance(0.4)) {
      p.type = 'ex';
      x.log(`${x.first(p.npcId)} broke up with you.`, 'bad');
      x.mods({ happiness: -8, romanticCynicism: 5 });
    }
  }
  // Betrayal.
  const betrayable = c.relationships.filter((r) => ['friend', 'bestFriend', 'businessPartner', 'coConspirator', 'protege', 'mentor', 'handler', 'spouse', 'partner', 'cellmate'].includes(r.type) && x.npc(r.npcId)?.alive);
  for (const r of betrayable) {
    const npc = x.npc(r.npcId)!;
    let p = 0.004;
    if (npc.wealth < 5000) p *= 2;
    if (r.meta.debt) p *= 2;
    if (x.stat('karma') < -30) p *= 1.8;
    if (c.politics.office || c.crime.orgRank >= 3) p *= 1.6;
    if (x.rels('nemesis').length) p *= 1.5;
    p *= (100 - r.trust) / 50;
    p *= (100 - npc.loyalty) / 50;
    if (x.chance(p) && !x.queued('betrayal')) {
      x.queue('betrayal', { npcId: r.npcId, kind: r.type });
      break;
    }
  }
  // Enemies act.
  const foes = x.rels('nemesis', 'enemy');
  if (foes.length && x.chance(0.15 * foes.length * (x.curse('violence') ? 3 : 1)) && !x.queued('enemy_strikes')) x.queue('enemy_strikes', { npcId: x.pick(foes).npcId });
  // Long loneliness without a partner wears people down.
  if (!p && c.age > 25 && x.stat('loneliness') > 60) x.mod('depression', 1);
}

/** Loss cascade: a loved one dies. */
export function onLoss(x: Ctx, npcId: string): void {
  const r = x.rel(npcId);
  const npc = x.npc(npcId);
  if (!r || !npc) return;
  const close = r.affinity / 100;
  const weight = r.type === 'spouse' ? 30 : r.type === 'child' ? 40 : r.type === 'parent' ? 18 : r.type === 'sibling' ? 14 : r.type === 'bestFriend' ? 14 : r.type === 'grandchild' ? 16 : 6;
  // A bad marriage ending is relief as much as grief.
  if (r.type === 'spouse' && r.affinity < 25) {
    x.mods({ happiness: 3, stress: -5 });
    x.log(`${npc.firstName}, your spouse, has died. You feel… mostly relief.`, 'neutral');
  } else if (weight >= 10) {
    trauma(x, weight * close, 'loss');
    x.mods({ happiness: -weight * close, depression: weight * close * 0.5 });
    if (['spouse', 'child', 'parent'].includes(r.type) && r.affinity > 50) onset(x, 'grief');
  }
  x.remember(`loss_${r.type}`, `Lost ${npc.firstName} (${r.type})`, Math.round(weight * 1.5), npcId);
}

export function relationshipLabel(r: Relationship): string {
  const map: Record<string, string> = {
    bestFriend: 'Best friend',
    debtHolder: 'Debt holder',
    businessPartner: 'Business partner',
    coConspirator: 'Co-conspirator',
    inLaw: 'In-law',
  };
  return map[r.type] ?? r.type.charAt(0).toUpperCase() + r.type.slice(1);
}
