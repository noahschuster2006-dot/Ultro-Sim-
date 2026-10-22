import { Ctx, fmtYear } from '../ctx';
import { CAREER_BY_ID } from '../data/careers';
import { countryName } from '../data/countries';
import { OFFICE_BY_ID } from '../data/politics';
import { STAT_DEFS } from '../data/stats';
import { normal } from '../rng';
import type { AfterlifeCard, AfterlifeTrack, Character, DeathType, DynastyMember, DynastyRepKey, FamilyHealth, FamilyStatus, GameState, NPC } from '../types';
import { blankCharacter, apMaxFor, rollStats } from './birth';
import { chronicMortality, lifespan } from './body';
import { currentTitle } from './careers';
import { aOrAn } from './npcs';
import { trauma } from './mind';
import { eraOf } from '../data/eras';
import { CHRONIC_BY_ID } from '../data/conditions';

export interface DeathCheck {
  cause: string;
  type: DeathType;
}

/** Yearly mortality. Most deaths follow the lifespan formula; some are acute. */
function deadlyCondition(x: Ctx): string | null {
  const deadly = x.c.bio.chronic.filter((ch) => (CHRONIC_BY_ID[ch.id]?.mortality ?? 0) > 0).sort((a, b) => (CHRONIC_BY_ID[b.id].mortality * b.severity) - (CHRONIC_BY_ID[a.id].mortality * a.severity));
  return deadly.length ? CHRONIC_BY_ID[deadly[0].id].name.toLowerCase() : null;
}

export function checkDeath(x: Ctx): DeathCheck | null {
  const c = x.c;
  if (c.stats.health <= 0) {
    const d = deadlyCondition(x);
    return { cause: d ? `complications of ${d}` : 'organ failure', type: 'hospital' };
  }
  if (c.age <= 2 && x.chance(eraOf(x.year).infantMortality * 0.35)) return { cause: x.pick(['a childhood fever', 'measles', 'a wasting sickness']), type: 'infancy' };
  const L = lifespan(x).final;
  let p: number;
  if (c.age >= L) p = 0.3 + 0.12 * (c.age - L);
  else if (c.age >= L - 5) p = 0.03 + (c.age - (L - 5)) * 0.025;
  else p = c.age < 40 ? 0.0008 : 0.002;
  p += chronicMortality(x);
  if (c.stats.health < 20) p += 0.08;
  let overdose = 0;
  for (const a of c.addictions) {
    if (!a.active) continue;
    if (a.kind === 'opioids' && a.severity >= 4) overdose += 0.07 * (a.severity - 3);
    if (a.kind === 'stimulants' && a.severity >= 4) overdose += 0.03;
    if (a.kind === 'alcohol' && a.severity >= 4.5) overdose += 0.02;
  }
  p += overdose;
  let combat = 0;
  const def = c.career ? CAREER_BY_ID[c.career.careerId] : undefined;
  if (def?.tags.includes('military') && x.w.war !== 'none') combat = { none: 0, regional: 0.01, major: 0.03, world: 0.05 }[x.w.war];
  p += combat;
  if (x.w.healthCrisis) p += (100 - x.stat('immunity')) / 4000 + (c.age > 65 ? 0.01 : 0);
  if (!x.chance(Math.min(0.97, p))) return null;
  // Miracles save the favored once.
  if (x.stat('divineFavor') >= 75 && c.spiritual.miraclesUsed < 1) {
    c.spiritual.miraclesUsed++;
    x.mod('divineFavor', -50);
    x.set('health', Math.max(40, x.stat('health')));
    x.log('✨ You should have died this year. Inexplicably, you did not. Witnesses call it a miracle.', 'major');
    x.remember('miracle', 'Survived certain death by a miracle', 70);
    return null;
  }
  const roll = x.r() * p;
  if (roll < overdose) return { cause: 'an overdose', type: 'overdose' };
  if (roll < overdose + combat) return { cause: `killed in action (${x.w.warName ?? 'war'})`, type: 'combat' };
  const atHome = x.rels('spouse', 'child', 'partner').length > 0 && x.stat('happiness') > 45;
  if (c.age >= L - 3) {
    const t: DeathType = atHome ? 'peaceful' : 'hospital';
    const d = deadlyCondition(x);
    return { cause: d && x.chance(0.5) ? d : t === 'peaceful' ? 'old age, peacefully at home' : 'old age', type: t };
  }
  const d = deadlyCondition(x);
  if (d) return { cause: d, type: 'disease' };
  if (x.w.healthCrisis && x.chance(0.5)) return { cause: x.w.healthCrisisName ?? 'an epidemic', type: 'disease' };
  return { cause: x.pick(['a car accident', 'a fall', 'a sudden heart attack', 'a stroke', 'drowning']), type: x.chance(0.6) ? 'accident' : 'hospital' };
}

function afterlifeTrack(c: Character): AfterlifeTrack {
  const k = c.stats.karma;
  const sin = c.stats.sin;
  if (c.spiritual.soulSold) return 'hell';
  if (k >= 95 && sin <= 0.5) return 'transcendence';
  if (k < -40 || sin > 70) return 'hell';
  if ((c.religionId === 'hinduism' || c.religionId === 'buddhism') && c.stats.faith > 40) return 'reincarnation';
  if (k > 40 && sin < 40) return 'heaven';
  if (sin >= 30) return 'purgatory';
  return 'reincarnation';
}

function lifeArchetype(x: Ctx): string {
  const c = x.c;
  const s = c.stats;
  if (c.spiritual.soulSold) return 'The Damned';
  if (c.politics.dictator) return 'The Tyrant';
  if (c.crime.orgRank >= 4) return 'The Kingpin';
  if (s.karma >= 80) return 'The Saint';
  if (s.fame >= 80) return 'The Star';
  if (c.politics.office && OFFICE_BY_ID[c.politics.office]?.tier >= 6) return 'The Statesman';
  if (s.infamy >= 60) return 'The Villain';
  if (x.netWorth() > 50000000) return 'The Magnate';
  if (x.rels('child').length >= 4) return 'The Patriarch/Matriarch';
  if (c.career && CAREER_BY_ID[c.career.careerId]?.tags.includes('creative')) return 'The Artist';
  if (s.wisdom >= 70) return 'The Sage';
  if (c.legal.record.length >= 3) return 'The Outlaw';
  if (x.rels('spouse').length && s.happiness > 60) return 'The Lover';
  return 'The Wanderer';
}

const TRACK_TEXT: Record<AfterlifeTrack, string> = {
  heaven: 'The scales tip toward the light. A door opens onto something warm.',
  transcendence: 'No judgment is needed. You simply become part of everything good you ever did.',
  purgatory: 'You wait in grey halls, weighing what you did against what you meant to do.',
  hell: 'The ledger is red. Something below has been expecting you.',
  reincarnation: 'The wheel turns. You will walk the world again, carrying faint echoes.',
};

const ECHO_TEXT: Record<AfterlifeTrack, string> = {
  heaven: 'Your heirs will be born under a gentle sign: a little faith, a little favor.',
  transcendence: 'Your bloodline is blessed; the next child is born with unusual grace.',
  purgatory: 'The next generation inherits your unfinished business.',
  hell: 'A shadow follows the bloodline: the next child is born with a dark omen.',
  reincarnation: 'The next child seems to remember things they were never taught.',
};

function bestTitle(x: Ctx): string {
  const c = x.c;
  let best = { level: 0, title: c.career ? currentTitle(x) : c.retired ? 'Retiree' : 'Unknown' };
  if (c.career) best = { level: c.career.level, title: currentTitle(x) };
  for (const h of c.careerHistory) {
    const lvl = CAREER_BY_ID[h.careerId] ? CAREER_BY_ID[h.careerId].ladder.indexOf(h.title) + 1 : 0;
    if (lvl > best.level) best = { level: lvl, title: h.title };
  }
  if (c.politics.office) best = { level: 99, title: OFFICE_BY_ID[c.politics.office].name };
  if (c.crime.orgRank >= 4 && c.crime.orgName) best = { level: 99, title: `head of ${c.crime.orgName}` };
  return best.title;
}

function obituary(x: Ctx, cause: string): string {
  const c = x.c;
  const parts: string[] = [];
  parts.push(`${c.firstName} ${c.lastName} died in ${countryName(c.countryId, x.year)} in ${fmtYear(x.year)} at the age of ${c.age}, of ${cause}.`);
  const title = bestTitle(x);
  if (title && title !== 'Unknown') parts.push(`They will be remembered as ${aOrAn(title)} ${title}.`);
  const sp = x.spouse();
  const kids = x.rels('child').length;
  if (sp || kids) parts.push(`Survived by ${[sp ? `their spouse ${x.first(sp.npcId)}` : '', kids ? `${kids} child${kids > 1 ? 'ren' : ''}` : ''].filter(Boolean).join(' and ')}.`);
  if (c.legal.record.length) parts.push(`A criminal record of ${c.legal.record.length} conviction${c.legal.record.length > 1 ? 's' : ''} followed them to the grave.`);
  if (c.stats.fame >= 50) parts.push('Thousands mourned publicly.');
  const top = c.memories.slice(0, 3).map((m) => m.text.toLowerCase());
  if (top.length) parts.push(`Defining moments: ${top.join('; ')}.`);
  return parts.join(' ');
}

const EDU_SCORE: Record<string, number> = { phd: 90, medical: 85, law: 80, mba: 70, university: 60, militaryAcademy: 55, seminary: 50, communityCollege: 40, online: 40, tradeSchool: 35, secondary: 30, primary: 15 };

function repScores(x: Ctx): Record<DynastyRepKey, number> {
  const c = x.c;
  const s = c.stats;
  const edu = Math.max(0, ...c.education.completed.map((e) => EDU_SCORE[e] ?? 0));
  const tier = c.politics.office ? OFFICE_BY_ID[c.politics.office].tier : Object.keys(c.flags).filter((k) => k.startsWith('held_')).length;
  return {
    criminal: Math.max(s.criminalRep, s.infamy, c.crime.orgRank * 14),
    political: Math.max(tier * 11, c.politics.office ? s.politicalApproval : s.politicalApproval / 2),
    social: (s.publicImage + (s.karma + 100) / 2) / 2,
    spiritual: Math.max(s.spiritualAuthority, s.faith * 0.6, c.spiritual.foundedReligion ? 80 : 0),
    scholarly: (edu + s.smarts) / 2,
    business: Math.max(0, Math.min(100, Math.log10(Math.max(1, x.netWorth())) * 12 - 25)),
  };
}

function willShares(x: Ctx, heirs: NPC[]): Record<string, number> {
  const will = x.c.will;
  const shares: Record<string, number> = {};
  if (will && Object.keys(will.shares).length) {
    const total = heirs.reduce((t, h) => t + (will.shares[h.id] ?? 0), 0);
    if (total > 0) {
      for (const h of heirs) shares[h.id] = (will.shares[h.id] ?? 0) / total;
      return shares;
    }
  }
  // No will: equal split, nudged toward favored children.
  const weights = heirs.map((h) => 1 + Math.max(0, h.favor ?? 0) * 0.08);
  const sum = weights.reduce((a, b) => a + b, 0);
  heirs.forEach((h, i) => (shares[h.id] = weights[i] / sum));
  return shares;
}

export function heirCandidates(s: GameState): NPC[] {
  const x = new Ctx(s);
  const kids = x.c.relationships.filter((r) => r.type === 'child').map((r) => s.npcs[r.npcId]).filter((n) => n?.alive);
  if (kids.length) return kids;
  const grand = x.c.relationships.filter((r) => r.type === 'grandchild').map((r) => s.npcs[r.npcId]).filter((n) => n?.alive);
  if (grand.length) return grand;
  // Dynasty members anywhere in the tree (e.g. grandchildren born to your children).
  return Object.values(s.npcs).filter((n) => n.alive && n.dynasty && n.parentIds.some((p) => kids.some((k) => k.id === p)));
}

/** The character dies: obituary, afterlife reading, estate, dynasty update. */
export function die(x: Ctx, cause: string, type: DeathType): void {
  const s = x.s;
  const c = x.c;
  c.alive = false;
  c.causeOfDeath = cause;
  c.deathType = type;
  s.phase = 'dead';
  s.queue = [];
  x.log(`⚰️ You died of ${cause} at age ${c.age}.`, 'major');
  const track = afterlifeTrack(c);
  const archetype = lifeArchetype(x);
  const cards: AfterlifeCard[] = [
    { title: archetype, text: `Karma ${Math.round(c.stats.karma)}, faith ${Math.round(c.stats.faith)}, sin ${Math.round(c.stats.sin)}. The life you led shaped the card you drew.` },
    { title: track.charAt(0).toUpperCase() + track.slice(1), text: TRACK_TEXT[track] },
    { title: 'The Echo', text: ECHO_TEXT[track] },
  ];
  const estate = x.netWorth();
  const gross = Math.max(0, c.money + c.assets.filter((a) => !a.seized && a.typeId !== 'territory' && a.typeId !== 'familyEstate').reduce((t, a) => t + a.value - a.mortgage, 0) - c.debt);
  let pool = Math.round(gross * 0.7 * (1 - (c.will?.charity ?? 0)));
  const heirs = heirCandidates(s);
  const contested = !c.will && heirs.length >= 2 && x.chance(0.6);
  if (contested) {
    pool = Math.round(pool * x.float(0.75, 0.9));
    for (const h of heirs) h.loyalty = Math.max(0, h.loyalty - 15);
  }
  const shares = willShares(x, heirs);
  const relationOf = (n: NPC) => x.rel(n.id)?.type ?? 'descendant';
  const D = s.dynasty;
  const fame = c.stats.fame;
  const infamy = c.stats.infamy;
  const legendary = c.age >= 75 && (fame >= 80 || infamy >= 80);
  const officeTier = c.politics.office ? OFFICE_BY_ID[c.politics.office].tier : 0;
  const prestigeGained = Math.round(
    fame / 5 + infamy / 6 + (c.career?.level ?? 0) * 2 + Math.max(0, Math.log10(Math.max(1, estate)) * 4) + (Math.abs(c.stats.karma) >= 80 ? 10 : 0) + x.rels('child').length * 2 + (legendary ? 30 : 0) + officeTier * 5 + c.crime.orgRank * 4 + c.age / 10,
  );
  D.prestige += prestigeGained;
  D.totalWealth += Math.max(0, estate);
  const scores = repScores(x);
  for (const k of Object.keys(D.reputation) as DynastyRepKey[]) D.reputation[k] = Math.round(D.reputation[k] * 0.6 + scores[k] * 0.4);
  // Family enemies and allies are remembered.
  for (const r of x.rels('nemesis', 'enemy')) {
    if (!D.enemies.some((e) => e.npcId === r.npcId)) D.enemies.push({ npcId: r.npcId, name: x.name(r.npcId), reason: `Feud with ${c.firstName}`, generation: D.generation });
  }
  for (const r of x.rels('bestFriend', 'mentor', 'businessPartner')) {
    if (r.affinity > 70 && !D.allies.some((e) => e.npcId === r.npcId)) D.allies.push({ npcId: r.npcId, name: x.name(r.npcId), reason: `Loyal to ${c.firstName}`, generation: D.generation });
  }
  if (D.enemies.length > 12) D.enemies.splice(0, D.enemies.length - 12);
  if (D.allies.length > 12) D.allies.splice(0, D.allies.length - 12);
  // Curses weaken by one level per generation, blessings by half a level.
  const curses = new Map(D.curses.map((q) => [q.id, q]));
  for (const cu of c.spiritual.curses) {
    const ex = curses.get(cu.id);
    if (!ex || ex.level < cu.level) curses.set(cu.id, { ...cu });
  }
  D.curses = [...curses.values()].map((q) => ({ ...q, level: q.level - 1 })).filter((q) => q.level >= 1);
  const blessings = new Map(D.blessings.map((q) => [q.id, q]));
  for (const b of c.spiritual.blessings) blessings.set(b.id, { ...b });
  D.blessings = [...blessings.values()].map((q) => ({ ...q, level: q.level - 0.5 })).filter((q) => q.level >= 1);
  if (track === 'transcendence') D.blessings.push({ id: 'fortune', level: 1, source: 'Transcendence' });
  D.traitPool = [...new Set([...c.traits, ...D.traitPool])].slice(0, 8);
  D.omen = track;
  if (legendary) {
    const title = fame >= infamy ? `the legendary ${bestTitle(x).toLowerCase()}` : `the infamous ${bestTitle(x).toLowerCase()}`;
    s.world.legends.push({ name: `${c.firstName} ${c.lastName}`, dynasty: D.name, year: x.year, kind: fame >= infamy ? 'fame' : 'infamy', title });
    s.world.chronicle.push({ year: x.year, countryId: c.countryId, title: 'A legend dies', text: `${c.firstName} ${c.lastName}, ${title}, has died. Stories about them will outlive everyone who knew them.` });
  }
  const member: DynastyMember = {
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    generation: c.generation,
    birthYear: c.birthYear,
    deathYear: x.year,
    age: c.age,
    cause,
    deathType: type,
    title: bestTitle(x),
    netWorth: estate,
    fame: Math.round(fame),
    infamy: Math.round(infamy),
    karma: Math.round(c.stats.karma),
    afterlife: track,
    epitaph: cards[0].title,
    legendary,
    countryId: c.countryId,
  };
  D.members.push(member);
  s.death = {
    name: member.name,
    age: c.age,
    year: x.year,
    cause,
    deathType: type,
    obituary: obituary(x, cause),
    afterlife: track,
    cards,
    estate,
    inheritancePool: pool,
    heirs: heirs.map((h) => ({ npcId: h.id, name: `${h.firstName} ${h.lastName}`, age: x.year - h.birthYear, share: Math.round(pool * (shares[h.id] ?? 0)), relation: relationOf(h) })),
    prestigeGained,
    legendary,
    milestones: [],
  };
  if (contested) s.death.obituary += ' The will was contested; lawyers took a bite of the estate and the siblings stopped speaking.';
  // Death type echoes into the family.
  for (const r of x.rels('child', 'spouse')) {
    const n = x.npc(r.npcId);
    if (!n) continue;
    if (type === 'murder' || type === 'execution') n.notes.push(`Haunted by ${c.firstName}'s ${type}`);
  }
  if (!heirs.length) s.phase = 'over';
}

const MILESTONES: { gen: number; id: string; name: string; test: (s: GameState) => boolean }[] = [
  { gen: 2, id: 'recognition', name: 'Family name recognition', test: (s) => Object.values(s.dynasty.reputation).some((v) => v > 40) },
  { gen: 3, id: 'crest', name: 'Dynasty crest and motto', test: (s) => s.dynasty.prestige >= 100 },
  { gen: 5, id: 'estate', name: 'Family estate (persistent property)', test: (s) => s.dynasty.totalWealth >= 1000000 },
  { gen: 7, id: 'remembered', name: 'Dynasty NPCs remember you by name', test: (s) => Object.values(s.dynasty.reputation).some((v) => v > 70) },
  { gen: 10, id: 'historical', name: 'Historical figure status for founders', test: (s) => s.dynasty.prestige >= 300 },
  { gen: 15, id: 'institutional', name: 'Institutional control', test: (s) => s.dynasty.reputation.political > 60 && s.dynasty.reputation.spiritual > 60 && s.dynasty.reputation.criminal > 60 },
  { gen: 20, id: 'legend', name: 'Dynasty legend event chain', test: (s) => s.dynasty.totalWealth >= 10000000 && s.dynasty.prestige >= 500 },
  { gen: 50, id: 'ancient', name: 'Ancient bloodline status', test: () => true },
  { gen: 100, id: 'mythic', name: 'Mythic status', test: () => true },
];

export const DYNASTY_MILESTONES = MILESTONES;

const CRESTS = ['a black wolf on silver', 'a golden lion rampant', 'a crowned serpent', 'three silver keys', 'a burning tower', 'an open book beneath a star', 'a raven over crossed swords', 'a white stag'];
const MOTTOS = ['Blood remembers', 'Ever upward', 'We endure', 'Fortune favors us', 'Faith and fire', 'Nothing forgotten', 'By our own hands', 'From dust, empire'];

function familyStatusFor(old: FamilyStatus, inheritance: number): FamilyStatus {
  if (old === 'royalty') return 'royalty';
  if (old === 'aristocracy') return 'aristocracy';
  if (inheritance > 10000000) return 'wealthy';
  if (inheritance > 400000) return 'middle';
  if (inheritance > 30000) return 'working';
  if (inheritance > 2000) return 'poor';
  return old === 'wealthy' ? 'middle' : old;
}

function parentingStyle(old: Character, aff: number): FamilyHealth {
  if (old.addictions.some((a) => a.kind === 'alcohol' && a.active)) return 'alcoholic';
  if (old.stats.aggression > 75 && aff < 50) return 'abusive';
  if (aff >= 70) return 'loving';
  if (aff >= 50) return 'overprotective';
  if (aff >= 30) return 'absent';
  return 'neglectful';
}

/** Continue the dynasty as one of the heirs. */
export function continueAs(s: GameState, heirId: string): void {
  const report = s.death;
  const old = s.char;
  const heir = s.npcs[heirId];
  if (!report || !heir) throw new Error('No such heir');
  const D = s.dynasty;
  // The deceased lives on as an NPC record in the family tree.
  s.npcs[old.id] = {
    id: old.id,
    firstName: old.firstName,
    lastName: old.lastName,
    gender: old.gender,
    sexuality: old.sexuality,
    birthYear: old.birthYear,
    alive: false,
    deathYear: s.world.year,
    causeOfDeath: old.causeOfDeath,
    countryId: old.countryId,
    religionId: old.religionId,
    smarts: old.stats.smarts,
    looks: old.stats.looks,
    health: 0,
    karma: old.stats.karma,
    ambition: 50,
    aggression: old.stats.aggression,
    charisma: old.stats.charisma,
    loyalty: 50,
    fame: old.stats.fame,
    wealth: 0,
    career: old.career ? { careerId: old.career.careerId, level: old.career.level } : null,
    education: old.education.completed,
    traits: old.traits,
    links: [],
    childIds: old.relationships.filter((r) => r.type === 'child').map((r) => r.npcId),
    parentIds: old.relationships.filter((r) => r.type === 'parent').map((r) => r.npcId),
    notes: [report.obituary],
    dynasty: true,
  };
  const share = report.heirs.find((h) => h.npcId === heirId)?.share ?? 0;
  const oldRel = old.relationships.find((r) => r.npcId === heirId);
  const c = blankCharacter(heir.id);
  s.char = c;
  const x = new Ctx(s);
  c.firstName = heir.firstName;
  c.lastName = heir.lastName;
  c.gender = heir.gender;
  c.sexuality = heir.sexuality;
  c.birthYear = heir.birthYear;
  c.age = s.world.year - heir.birthYear;
  c.countryId = heir.countryId;
  c.birthCountryId = heir.countryId;
  c.religionId = heir.religionId;
  c.familyStatus = familyStatusFor(old.familyStatus, share + Math.max(0, heir.wealth));
  c.familyHealth = parentingStyle(old, oldRel?.affinity ?? 50);
  D.generation = Math.max(D.generation, old.generation) + 1;
  c.generation = D.generation;
  c.traits = [...new Set([...(heir.inherited?.traits ?? []), ...D.traitPool.filter(() => x.chance(0.3))])].slice(0, 5);
  if (heir.inherited?.predisposition) Object.assign(c.bio.predisposition, heir.inherited.predisposition);
  c.lifespan = { geneticsBonus: Math.round(old.lifespan.geneticsBonus * 0.5 + normal(s, 0, 2.5)), offset: x.int(-8, 8) };
  rollStats(x, c);
  const st = c.stats;
  st.smarts = heir.smarts;
  st.looks = heir.looks;
  st.health = Math.max(30, heir.health);
  st.karma = Math.max(-100, Math.min(100, heir.karma));
  st.charisma = heir.charisma;
  st.aggression = heir.aggression;
  st.fame = Math.round(heir.fame + old.stats.fame * 0.15);
  if (heir.upbringing === 'academic') st.discipline += 10;
  if (heir.upbringing === 'athletic') st.fitness += 15;
  if (heir.upbringing === 'criminal') {
    st.streetCred += 15;
    st.criminalRep += 10;
    c.flags.criminalContact = true;
  }
  if (heir.upbringing === 'spiritual') st.faith += 20;
  if (heir.upbringing === 'neglected') {
    st.loneliness += 20;
    st.trauma += 10;
  }
  for (const d of STAT_DEFS) st[d.id] = Math.max(d.min, Math.min(d.max, Math.round(st[d.id])));
  // Body.
  const adultH = heir.heightCm ?? Math.round(normal(s, c.gender === 'male' ? 176 : 163, 7));
  c.flags.adultHeight = adultH;
  if (c.age >= 18) {
    c.bio.heightCm = adultH;
    c.bio.weightKg = Math.round(22 * Math.pow(adultH / 100, 2) + normal(s, 0, 6));
  } else {
    const t = Math.min(1, c.age / 18);
    c.bio.heightCm = Math.round(50 + (adultH - 50) * Math.pow(t, 0.7));
    c.bio.weightKg = Math.round((15.5 + t * 6) * Math.pow(c.bio.heightCm / 100, 2));
  }
  // Money.
  c.money = share + Math.max(0, Math.round(heir.wealth));
  const dirtyShare = report.heirs.length ? 1 / report.heirs.length : 0;
  c.crime.dirtyMoney = Math.round(old.crime.dirtyMoney * dirtyShare);
  c.crime.offshore = Math.round(old.crime.offshore * dirtyShare);
  if (c.crime.dirtyMoney > 0) c.flags.criminalContact = true;
  // Education & career carried over for adult heirs.
  c.education.completed = [...new Set(['primary', ...(heir.education ?? [])])].filter((e) => c.age >= 12 || e !== 'secondary');
  if (c.age >= 18 && !c.education.completed.includes('secondary') && s.world.year >= 1900) c.education.completed.push('secondary');
  if (heir.career && CAREER_BY_ID[heir.career.careerId] && c.age >= 16) {
    const def = CAREER_BY_ID[heir.career.careerId];
    if (def.edu && !def.edu.some((e) => c.education.completed.includes(e))) c.education.completed.push(def.edu[0]);
    c.career = { careerId: def.id, level: heir.career.level, yearsInRole: 1, yearsInCareer: heir.career.level * 2, performance: 60, salary: Math.round(def.salary * Math.pow(def.growth, heir.career.level - 1)), employer: 'their employer', workEthic: 'normal' };
    for (const sk of def.trains) x.train(sk, 10 + heir.career.level * 4);
  } else if (c.age >= 6 && c.age < 18) {
    const prog = c.age < 12 ? 'primary' : 'secondary';
    c.education.completed = c.education.completed.filter((e) => e !== prog);
    if (prog === 'secondary' && !c.education.completed.includes('primary')) c.education.completed.push('primary');
    c.education.enrolled = { programId: prog, yearsLeft: (prog === 'primary' ? 12 : 18) - c.age, yearsDone: c.age - (prog === 'primary' ? 6 : 12) };
  }
  // Relationships carried over.
  const otherParentId = heir.parentIds.find((p) => p !== old.id);
  if (otherParentId && s.npcs[otherParentId]?.alive) x.addRel(otherParentId, 'parent', { affinity: 65, trust: 65 });
  x.addRel(old.id, 'parent', { affinity: oldRel?.affinity ?? 50, trust: oldRel?.trust ?? 50 });
  for (const r of old.relationships) {
    const n = s.npcs[r.npcId];
    if (!n?.alive || r.npcId === heirId) continue;
    if (r.type === 'child') x.addRel(r.npcId, 'sibling', { affinity: 50 + (heir.loyalty - 50) / 2, trust: 50 });
    if (r.type === 'parent') x.addRel(r.npcId, 'grandparent', { affinity: 60, trust: 60 });
    if (r.type === 'spouse' && r.npcId !== otherParentId) x.addRel(r.npcId, 'acquaintance', { affinity: 35, trust: 35, meta: { stepParent: true } });
    if (r.type === 'nemesis' || r.type === 'enemy') x.addRel(r.npcId, 'enemy', { affinity: 15, trust: 5, meta: { inherited: true } });
    if (r.type === 'bestFriend' && r.affinity > 70) x.addRel(r.npcId, 'mentor', { affinity: 55, trust: 60, meta: { inherited: true } });
  }
  for (const e of D.enemies) if (e.npcId && s.npcs[e.npcId]?.alive && !x.rel(e.npcId)) x.addRel(e.npcId, 'enemy', { affinity: 15, trust: 5, meta: { inherited: true } });
  for (const a of D.allies) if (a.npcId && s.npcs[a.npcId]?.alive && !x.rel(a.npcId)) x.addRel(a.npcId, 'friend', { affinity: 60, trust: 60, meta: { inherited: true } });
  if (heir.spouseId && s.npcs[heir.spouseId]?.alive) x.addRel(heir.spouseId, 'spouse', { affinity: 65, trust: 65 });
  for (const kid of heir.childIds) if (s.npcs[kid]?.alive) x.addRel(kid, 'child', { affinity: 75, trust: 75 });
  // Institutional memory.
  if (old.crime.orgName && D.reputation.criminal > 50) c.flags.familyOrg = old.crime.orgName;
  if (old.politics.party) c.politics.party = old.politics.party;
  // Supernatural inheritance.
  for (const cu of D.curses) c.spiritual.curses.push({ id: cu.id, level: Math.floor(cu.level), source: 'Bloodline' });
  for (const b of D.blessings) c.spiritual.blessings.push({ id: b.id, level: Math.floor(b.level), source: 'Bloodline' });
  // Persistent family estate.
  const estate = old.assets.find((a) => a.typeId === 'familyEstate');
  if (estate) c.assets.push({ ...estate });
  delete s.npcs[heirId];
  // Milestones.
  const unlocked: string[] = [];
  for (const m of MILESTONES) {
    if (D.generation >= m.gen && !D.milestones.includes(m.id) && m.test(s)) {
      D.milestones.push(m.id);
      unlocked.push(m.name);
      if (m.id === 'crest') {
        D.crest = x.pick(CRESTS);
        D.motto = x.pick(MOTTOS);
      }
      if (m.id === 'estate' && !c.assets.some((a) => a.typeId === 'familyEstate')) {
        const id = x.uid('a');
        c.assets.push({ id, typeId: 'familyEstate', name: `${D.name} family estate`, countryId: c.countryId, boughtYear: s.world.year, purchasePrice: 2000000, value: 2000000, mortgage: 0, rentedOut: false, condition: 90, level: 1, front: false, seized: false, meta: {}, dynastyEstate: true });
        D.estateAssetId = id;
      }
      if (m.id === 'historical') {
        const founder = D.members[0];
        if (founder) s.world.legends.push({ name: founder.name, dynasty: D.name, year: s.world.year, kind: 'fame', title: `founder of the ${D.name} dynasty` });
      }
      if (m.id === 'institutional') D.institutions.push({ kind: 'party', name: `the ${D.name} Party` }, { kind: 'crimeOrg', name: `the ${D.name} Family` });
      if (m.id === 'legend') x.chain('dynastyLegend', 2);
    }
  }
  report.milestones = unlocked;
  c.apMax = apMaxFor(c);
  c.ap = c.apMax;
  s.phase = 'alive';
  s.queue = [];
  s.recent = [];
  x.log(`You are ${c.firstName} ${c.lastName}, ${c.age}, generation ${c.generation} of the ${D.name} dynasty. ${report.name} has died.`, 'major');
  if (share > 0) x.log(`You inherited ${x.fmt(share)}.`, 'good');
  if (unlocked.length) x.log(`🏰 Dynasty milestone${unlocked.length > 1 ? 's' : ''}: ${unlocked.join(', ')}.`, 'major');
  if (c.flags.familyOrg) x.log(`${c.flags.familyOrg} remembers your bloodline. The underworld's doors are open to you.`, 'neutral');
  if (D.curses.length) x.log(`The bloodline still carries: ${D.curses.map((q) => q.id).join(', ')}.`, 'bad');
  trauma(x, oldRel && oldRel.affinity > 50 ? 12 : 4, 'loss');
  x.remember('parentDied', `${report.name} died`, 40, old.id);
  c.age = s.world.year - c.birthYear;
}
