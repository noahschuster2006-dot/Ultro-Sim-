import { Ctx } from '../ctx';
import { COUNTRY_BY_ID, countriesAvailable, religionWeights } from '../data/countries';
import { eraOf } from '../data/eras';
import { STAT_DEFS, emptyStats } from '../data/stats';
import { TRAITS } from '../data/occult';
import { chance, normal, pick, rint, weighted } from '../rng';
import type { Character, Dynasty, FamilyHealth, FamilyStatus, GameState, Gender, Settings, Sexuality } from '../types';
import { createWorld } from './world';
import { firstName, lastName } from './naming';
import { linkNpcs, makeNpc } from './npcs';
import { diagnose } from './body';
import { trauma } from './mind';

export const SAVE_VERSION = 1;

export interface NewLifeOptions {
  seed: number;
  year: number;
  countryId?: string;
  gender?: Gender;
  firstName?: string;
  lastName?: string;
  familyStatus?: FamilyStatus;
  sexuality?: Sexuality;
  religionId?: string;
  familyHealth?: FamilyHealth;
  /** Starting traits chosen by the player (added to any inherited ones). */
  traits?: string[];
  siblings?: 'none' | 'few' | 'many';
  settings?: Partial<Settings>;
}

const STATUS_WEIGHTS = (year: number): [FamilyStatus, number][] => {
  if (year < 1700) return [['destitute', 22], ['poor', 40], ['working', 22], ['middle', 9], ['wealthy', 4], ['aristocracy', 2.5], ['royalty', 0.5]];
  if (year < 1900) return [['destitute', 15], ['poor', 33], ['working', 30], ['middle', 14], ['wealthy', 5], ['aristocracy', 2.5], ['royalty', 0.5]];
  return [['destitute', 6], ['poor', 18], ['working', 34], ['middle', 30], ['wealthy', 9], ['aristocracy', 2.5], ['royalty', 0.5]];
};

const HEALTH_WEIGHTS: [FamilyHealth, number][] = [['loving', 45], ['overprotective', 15], ['absent', 12], ['neglectful', 12], ['alcoholic', 9], ['abusive', 7]];

const FAMILY_WEALTH: Record<FamilyStatus, number> = { destitute: 0, poor: 2000, working: 20000, middle: 120000, wealthy: 1500000, aristocracy: 8000000, royalty: 60000000 };

function rollSexuality(h: { rng: number }): Sexuality {
  const r = normal(h, 0, 1);
  if (r > 2.0) return 'gay';
  if (r > 1.7) return 'bisexual';
  if (r < -2.2) return 'asexual';
  return 'straight';
}

export function blankCharacter(id: string): Character {
  return {
    id,
    firstName: '',
    lastName: '',
    gender: 'male',
    sexuality: 'straight',
    birthYear: 0,
    age: 0,
    alive: true,
    countryId: 'us',
    birthCountryId: 'us',
    religionId: 'none',
    familyStatus: 'middle',
    familyHealth: 'loving',
    generation: 1,
    stats: emptyStats(),
    money: 0,
    debt: 0,
    lifestyle: 'modest',
    diet: 'balanced',
    exercise: 1,
    bio: {
      heightCm: 50,
      weightKg: 3.4,
      bodyType: 'mesomorph',
      chronic: [],
      injuries: [],
      cosmetics: [],
      caps: {},
      predisposition: { addiction: 0, depression: 0, anxiety: 0, heart: 0, cancer: 0, diabetes: 0, dementia: 0, bipolar: 0 },
      steroidYears: 0,
    },
    mental: { conditions: [], therapy: false, medication: false, supportGroup: false, crises: 0, dementiaStage: 0 },
    addictions: [],
    education: { enrolled: null, completed: [], grades: 50, droppedOut: false, tutored: false },
    career: null,
    careerHistory: [],
    retired: false,
    skills: {},
    hobbies: [],
    relationships: [],
    assets: [],
    pets: [],
    items: [],
    legal: { record: [], juvenileRecord: false, cases: [], prison: null, parole: 0, probation: 0, lawsuits: [], interpolNotice: false, fugitive: false, witnessProtection: null, lawyer: 0, arrests: 0 },
    crime: { orgName: null, orgRank: 0, orgLoyalty: 0, territory: 0, operations: [], rivalOrgs: [], dirtyMoney: 0, offshore: 0, committed: {}, launderStage: 0 },
    media: { stories: [], secrets: [], cancelled: null, followers: 0, prFirm: false },
    spiritual: { pacts: [], soulSold: false, curses: [], blessings: [], rituals: 0, societies: [], invites: [], foundedReligion: null, followers: 0, miraclesUsed: 0, visions: [] },
    politics: { office: null, officeCountry: null, term: 0, party: null, cabinet: [], laws: [], wars: [], electionsWon: 0, electionsLost: 0, dictator: false, coupRisk: 0 },
    traits: [],
    memories: [],
    chains: [],
    flags: {},
    eventHistory: {},
    totals: { happiness: 0, health: 0, years: 0 },
    lifespan: { geneticsBonus: 0, offset: 0 },
    will: null,
    ap: 0,
    apMax: 1,
    log: [],
  };
}

export function newDynasty(name: string, year: number): Dynasty {
  return {
    id: `dyn-${name}-${year}`,
    name,
    foundedYear: year,
    generation: 1,
    reputation: { criminal: 30, political: 30, social: 40, spiritual: 30, scholarly: 30, business: 30 },
    prestige: 0,
    totalWealth: 0,
    members: [],
    curses: [],
    blessings: [],
    enemies: [],
    allies: [],
    institutions: [],
    milestones: [],
    crest: null,
    motto: null,
    estateAssetId: null,
    traitPool: [],
    omen: null,
  };
}

/** Roll a fresh set of starting stats for a character of a given background. */
export function rollStats(x: Ctx, c: Character): void {
  const n = (m: number, sd: number) => normal(x.s, m, sd);
  const st = c.stats;
  for (const d of STAT_DEFS) st[d.id] = 0;
  st.happiness = n(75, 10);
  st.health = n(90, 8);
  st.smarts = n(50, 17);
  st.looks = n(50, 17);
  st.fitness = n(45, 12);
  st.anxiety = n(12, 7);
  st.depression = n(5, 5);
  st.empathy = n(55, 15);
  st.aggression = n(25, 12);
  st.discipline = n(45, 15);
  st.creativity = n(50, 15);
  st.riskTolerance = n(35, 12);
  st.willpower = n(50, 15);
  st.resilience = n(50, 15);
  st.charisma = n(50, 15);
  st.popularity = 50;
  st.confidence = n(55, 12);
  st.loneliness = 10;
  st.publicImage = 50;
  st.politicalApproval = 25;
  st.faith = c.religionId === 'none' ? n(10, 8) : n(45, 18);
  st.paranormal = Math.max(0, n(5, 8));
  st.immunity = n(65, 12);
  st.energy = 90;
  st.fertility = n(75, 12);
  st.dexterity = n(45, 15);
  // Traits.
  const t = c.traits;
  if (t.includes('aggressive')) st.aggression += 25;
  if (t.includes('empathetic')) st.empathy += 20;
  if (t.includes('scholarly')) st.smarts += 12;
  if (t.includes('athletic')) st.fitness += 15;
  if (t.includes('charismatic')) st.charisma += 18;
  if (t.includes('devout')) st.faith += 25;
  if (t.includes('riskTaker')) st.riskTolerance += 25;
  if (t.includes('resilient')) st.resilience += 20;
  if (t.includes('beautiful')) st.looks += 18;
  if (t.includes('paranormal')) st.paranormal += 35;
  if (t.includes('melancholic')) c.bio.predisposition.depression += 0.3;
  if (t.includes('anxious')) c.bio.predisposition.anxiety += 0.3;
  if (t.includes('addictive')) c.bio.predisposition.addiction += 0.3;
  if (t.includes('frail')) st.health -= 15;
  for (const d of STAT_DEFS) st[d.id] = Math.max(d.min, Math.min(d.max, Math.round(st[d.id])));
}

function familyHealthEffects(x: Ctx): void {
  switch (x.c.familyHealth) {
    case 'abusive':
      trauma(x, 18, 'abuse');
      x.mods({ anxiety: 15, aggression: 8, confidence: -10 });
      break;
    case 'alcoholic':
      trauma(x, 10, 'abuse');
      x.mods({ anxiety: 8 });
      x.c.bio.predisposition.addiction += 0.2;
      break;
    case 'neglectful':
      x.mods({ loneliness: 20, confidence: -6 });
      break;
    case 'absent':
      x.mods({ loneliness: 12, resilience: 5 });
      break;
    case 'loving':
      x.mods({ happiness: 8, resilience: 6, confidence: 6 });
      break;
    case 'overprotective':
      x.mods({ anxiety: 10, confidence: -5, riskTolerance: -10 });
      break;
  }
}

/** Build the family around a newborn: parents, siblings, grandparents. */
function makeFamily(x: Ctx, siblings?: 'none' | 'few' | 'many'): void {
  const c = x.c;
  const year = x.year;
  const wealth = FAMILY_WEALTH[c.familyStatus];
  const parentAge = rint(x.s, 18, 40);
  const dadKarma = c.familyHealth === 'abusive' ? -40 : c.familyHealth === 'loving' ? 30 : 5;
  const dad = makeNpc(x, { gender: 'male', age: parentAge + rint(x.s, 0, 6), lastName: c.lastName, wealth: wealth / 2, karma: dadKarma, aggression: c.familyHealth === 'abusive' ? 70 : undefined, religionId: c.religionId, sexuality: 'straight' });
  const mom = makeNpc(x, { gender: 'female', age: parentAge, lastName: chance(x.s, 0.6) ? c.lastName : undefined, wealth: wealth / 2, religionId: c.religionId, sexuality: 'straight' });
  dad.spouseId = mom.id;
  mom.spouseId = dad.id;
  linkNpcs(x, dad.id, mom.id, 'spouse');
  dad.childIds.push(c.id);
  mom.childIds.push(c.id);
  const absent = c.familyHealth === 'absent';
  const parentAff = c.familyHealth === 'loving' ? 85 : c.familyHealth === 'overprotective' ? 80 : c.familyHealth === 'abusive' ? 25 : c.familyHealth === 'neglectful' ? 35 : 55;
  x.addRel(dad.id, 'parent', { affinity: absent ? 20 : parentAff, trust: parentAff });
  x.addRel(mom.id, 'parent', { affinity: parentAff + 5, trust: parentAff });
  if (absent) dad.notes.push('Left the family');
  if (c.familyHealth === 'alcoholic') dad.traits.push('alcoholic');
  // Siblings: older ones already exist; more children in older eras.
  const max = year < 1900 ? 6 : year < 1970 ? 4 : 3;
  const rolled = Math.min(max, Math.max(0, Math.round(normal(x.s, year < 1900 ? 3 : 1.4, 1.4))));
  const count = siblings === 'none' ? 0 : siblings === 'few' ? Math.max(1, Math.min(2, rolled)) : siblings === 'many' ? Math.max(4, Math.min(6, parentAge - 18 > 4 ? 6 : 4)) : rolled;
  for (let i = 0; i < count; i++) {
    const age = rint(x.s, 1, Math.min(14, parentAge - 17));
    const sib = makeNpc(x, { age, lastName: c.lastName, career: null, religionId: c.religionId, parentIds: [dad.id, mom.id] });
    dad.childIds.push(sib.id);
    mom.childIds.push(sib.id);
    linkNpcs(x, sib.id, dad.id, 'family');
    linkNpcs(x, sib.id, mom.id, 'family');
    x.addRel(sib.id, 'sibling', { affinity: rint(x.s, 40, 80), trust: 55 });
  }
  if (count === 0 && siblings !== 'none' && chance(x.s, 0.4)) c.flags.youngerSiblingDue = rint(x.s, 2, 6);
  // Grandparents.
  if (chance(x.s, 0.6)) {
    const gp = makeNpc(x, { age: parentAge + rint(x.s, 20, 32), lastName: c.lastName, wealth: wealth / 3, religionId: c.religionId, career: null });
    linkNpcs(x, gp.id, dad.id, 'family');
    x.addRel(gp.id, 'grandparent', { affinity: rint(x.s, 55, 90), trust: 70 });
  }
}

/** Actions per year: more of them once you are old enough to run your own life. */
export function apMaxFor(c: Character): number {
  if (c.age < 3) return 1;
  if (c.age < 6) return 2;
  if (c.age < 13) return 3;
  if (c.age < 18) return 4;
  if (c.legal.prison) return 4;
  let ap = 6;
  if (!c.career || c.retired) ap += 1;
  if (c.career?.workEthic === 'hard') ap -= 1;
  if (c.age >= 75) ap -= 1;
  if (c.age >= 90) ap -= 1;
  return Math.max(1, ap);
}

/** Create a newborn character in the current world (used for new games). */
export function birthCharacter(x: Ctx, o: Omit<NewLifeOptions, 'seed' | 'year' | 'settings'>, dynasty: Dynasty): Character {
  const year = x.year;
  const available = countriesAvailable(year);
  const countryId = o.countryId && COUNTRY_BY_ID[o.countryId] && COUNTRY_BY_ID[o.countryId].availableFrom <= year ? o.countryId : pick(x.s, available).id;
  const c = blankCharacter(x.uid('p'));
  x.s.char = c;
  c.countryId = countryId;
  c.birthCountryId = countryId;
  c.birthYear = year;
  c.gender = o.gender ?? (chance(x.s, 0.5) ? 'male' : 'female');
  c.sexuality = o.sexuality ?? rollSexuality(x.s);
  c.lastName = o.lastName?.trim() || dynasty.name || lastName(x.s, countryId, year);
  c.firstName = o.firstName?.trim() || firstName(x.s, countryId, year, c.gender);
  c.familyStatus = o.familyStatus ?? weighted(x.s, STATUS_WEIGHTS(year), ([, w]) => w)![0];
  c.familyHealth = o.familyHealth ?? weighted(x.s, HEALTH_WEIGHTS, ([, w]) => w)![0];
  c.religionId = o.religionId ?? weighted(x.s, religionWeights(countryId, year), ([, w]) => w)?.[0] ?? 'none';
  c.generation = dynasty.generation;
  // Genetics.
  const nutrition = year < 1900 ? -7 : year < 1950 ? -3 : 0;
  const statusAdj = c.familyStatus === 'destitute' ? -4 : ['wealthy', 'aristocracy', 'royalty'].includes(c.familyStatus) ? 2 : 0;
  c.flags.adultHeight = Math.round(normal(x.s, c.gender === 'male' ? 176 : c.gender === 'female' ? 163 : 170, 7) + nutrition + statusAdj);
  c.bio.bodyType = pick(x.s, ['ectomorph', 'mesomorph', 'endomorph'] as const);
  for (const k of Object.keys(c.bio.predisposition) as (keyof typeof c.bio.predisposition)[]) c.bio.predisposition[k] = Math.max(0, Math.round(normal(x.s, 0.08, 0.1) * 100) / 100);
  // Dynasty traits layer on top of genetics.
  const pool = dynasty.traitPool.length ? dynasty.traitPool : [];
  c.traits = pool.filter(() => chance(x.s, 0.35)).slice(0, 3);
  if (o.traits?.length) {
    for (const t of o.traits) if (TRAITS.some((d) => d.id === t) && !c.traits.includes(t)) c.traits.push(t);
  } else if (chance(x.s, 0.6)) {
    const t = pick(x.s, TRAITS).id;
    if (!c.traits.includes(t)) c.traits.push(t);
  }
  c.lifespan = { geneticsBonus: Math.round(normal(x.s, 0, 3)), offset: rint(x.s, -8, 8) };
  rollStats(x, c);
  // Genetic disorders.
  if (chance(x.s, 0.01)) c.flags.huntington = true;
  if (chance(x.s, 0.02) && ['ng', 'in', 'sa', 'eg', 'br'].includes(countryId)) diagnose(x, 'sickleCell', true);
  if (chance(x.s, 0.06)) diagnose(x, 'asthma', true);
  makeFamily(x, o.siblings);
  familyHealthEffects(x);
  // Dynasty reputation shapes how the world treats you from birth.
  const rep = dynasty.reputation;
  if (rep.criminal > 70) {
    x.mods({ heat: 10, streetCred: 10 });
    c.flags.criminalContact = true;
  }
  if (rep.social > 70) x.mods({ publicImage: 10, popularity: 8 });
  if (rep.political > 70) x.mod('politicalApproval', 15);
  if (rep.spiritual > 70) x.mod('faith', 10);
  if (c.familyStatus === 'royalty') {
    c.flags.royalHeir = true;
    c.flags.lineOfSuccession = x.rels('sibling').length + 1;
    x.mod('fame', 30);
  }
  if (c.familyStatus === 'aristocracy') x.mod('fame', 8);
  for (const curse of dynasty.curses) if (curse.level >= 1) c.spiritual.curses.push({ id: curse.id, level: Math.floor(curse.level), source: 'Bloodline' });
  for (const b of dynasty.blessings) if (b.level >= 1) c.spiritual.blessings.push({ id: b.id, level: Math.floor(b.level), source: 'Bloodline' });
  c.apMax = apMaxFor(c);
  c.ap = c.apMax;
  const era = eraOf(year);
  const w = x.w;
  let opener = `You were born ${c.gender === 'male' ? 'a boy' : c.gender === 'female' ? 'a girl' : 'a child'} in ${x.countryName}, ${year < 0 ? `${-year} BC` : year}, into a ${c.familyStatus} family.`;
  if (w.war !== 'none') opener += ` Your country is at war (${w.warName ?? 'conflict'}).`;
  if (w.healthCrisis) opener += ` ${w.healthCrisisName ?? 'An epidemic'} is raging.`;
  x.log(opener, 'major');
  x.log(`Era: ${era.name}. Ruler: ${w.ruler}. ${x.rels('sibling').length ? `You have ${x.rels('sibling').length} older sibling(s).` : 'You are the first child.'}`, 'neutral');
  if (dynasty.omen) {
    const omenText: Record<string, string> = {
      heaven: 'Midwives swear a light filled the room at your birth.',
      transcendence: 'A hush fell over the town the night you were born.',
      hell: 'Crows gathered on the roof the night you were born.',
      purgatory: 'Your birth came during a long, grey rain.',
      reincarnation: 'Your grandmother insists you have your ancestor\'s eyes — and their memories.',
    };
    x.log(omenText[dynasty.omen], 'neutral');
    if (dynasty.omen === 'heaven' || dynasty.omen === 'transcendence') x.mods({ faith: 6, divineFavor: 5 });
    if (dynasty.omen === 'hell') x.mods({ paranormal: 10, karma: -5 });
    if (dynasty.omen === 'reincarnation') x.mods({ wisdom: 5, paranormal: 5 });
  }
  return c;
}

/** Create a new game: world, dynasty and newborn character. */
export function newGame(o: NewLifeOptions): GameState {
  const holder = { rng: o.seed | 0 };
  const world = createWorld(holder, o.year);
  const s: GameState = {
    version: SAVE_VERSION,
    seed: o.seed,
    rng: holder.rng,
    nextId: 1,
    phase: 'alive',
    world,
    dynasty: newDynasty('', o.year),
    char: blankCharacter('p0'),
    npcs: {},
    queue: [],
    recent: [],
    settings: { dementiaPath: false, matureThemes: true, ...o.settings },
    death: null,
  };
  const x = new Ctx(s);
  const country = o.countryId && COUNTRY_BY_ID[o.countryId]?.availableFrom <= o.year ? o.countryId : pick(s, countriesAvailable(o.year)).id;
  const surname = o.lastName?.trim() || lastName(s, country, o.year);
  s.dynasty = newDynasty(surname, o.year);
  s.dynasty.traitPool = [pick(s, TRAITS).id];
  birthCharacter(x, { ...o, countryId: country, lastName: surname }, s.dynasty);
  return s;
}
