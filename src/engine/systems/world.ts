import { COUNTRIES, COUNTRY_BY_ID, RELIGIONS, baseRegime, countryName, countryNameCap, countriesAvailable } from '../data/countries';
import { HISTORY, type HistoricalEvent } from '../data/history';
import { chance, normal, pick, rint, type RngHolder } from '../rng';
import type { Ctx } from '../ctx';
import type { ChronicleEntry, Regime, ReligionDominance, WarStatus, WorldContext, WorldState } from '../types';
import { fullName } from './naming';

const NORMS_OFFSET: Record<string, number> = {
  sa: -22, ir: -20, eg: -12, ng: -10, ru: -8, in: -8, cn: -6, co: -4, mx: -4, br: -2, za: -3, jp: -2, gr: -2,
  it: 0, es: 2, de: 3, fr: 3, gb: 3, us: 0, au: 4, ch: 4, ky: 0,
};

const WAR_RANK: Record<WarStatus, number> = { none: 0, regional: 1, major: 2, world: 3 };

/** The baseline already trends upward over time; history only bends it locally. */
const HISTORY_NORMS_WEIGHT = 0.35;

/** Social-norms baseline by year: the slow arc of tolerance. */
export function baseNorms(year: number): number {
  if (year < 1700) return 15;
  if (year < 1900) return 15 + ((year - 1700) / 200) * 15;
  if (year < 1950) return 30 + ((year - 1900) / 50) * 12;
  if (year < 2000) return 42 + ((year - 1950) / 50) * 23;
  if (year < 2025) return 65 + ((year - 2000) / 25) * 10;
  return Math.min(88, 75 + ((year - 2025) / 75) * 13);
}

function inScope(ev: HistoricalEvent, countryId: string): boolean {
  return ev.scope === 'global' || ev.scope.includes(countryId);
}

export function activeHistory(countryId: string, year: number): HistoricalEvent[] {
  return HISTORY.filter((ev) => year >= ev.from && year <= ev.to && inScope(ev, countryId));
}

export function rulerTitle(regime: Regime, gender: 'male' | 'female'): string {
  switch (regime) {
    case 'monarchy':
      return gender === 'male' ? 'King' : 'Queen';
    case 'empire':
      return gender === 'male' ? 'Emperor' : 'Empress';
    case 'democracy':
      return 'President';
    case 'autocracy':
      return 'Supreme Leader';
    case 'theocracy':
      return 'Grand Ayatollah';
    case 'junta':
      return 'General';
  }
}

function newRuler(h: RngHolder, countryId: string, year: number, regime: Regime): string {
  const g = regime === 'junta' || chance(h, 0.75) ? 'male' : 'female';
  return `${rulerTitle(regime, g)} ${fullName(h, countryId, year, g)}`;
}

function religionDominance(countryId: string, year: number, regime: Regime): ReligionDominance {
  if (regime === 'theocracy') return 'theocracy';
  if (year < 1790) return 'stateReligion';
  if (countryId === 'sa' || countryId === 'ir') return 'theocracy';
  if (['eg', 'gb', 'gr', 'ru'].includes(countryId) && year < 1990) return 'stateReligion';
  if (year < 1950) return 'stateReligion';
  return ['us', 'in', 'ng', 'br', 'za', 'au'].includes(countryId) ? 'pluralism' : 'secular';
}

export function makeContext(h: RngHolder, countryId: string, year: number): WorldContext {
  const def = COUNTRY_BY_ID[countryId];
  const regime = baseRegime(countryId, year);
  let normsShift = 0;
  for (const ev of HISTORY) if (ev.norms && ev.from <= year && inScope(ev, countryId)) normsShift += ev.norms * HISTORY_NORMS_WEIGHT;
  const ctx: WorldContext = {
    economy: def.economy,
    stability: def.stability,
    war: 'none',
    socialNorms: 50,
    religionDominance: religionDominance(countryId, year, regime),
    crimeRate: 40,
    healthCrisis: false,
    prohibition: false,
    cannabisLegal: false,
    regime,
    ruler: newRuler(h, countryId, year, regime),
    sanctions: 0,
    econShock: normal(h, 0, 6),
    stabShock: normal(h, 0, 6),
    crimeShock: 0,
    normsShift,
    procWar: null,
    procPandemic: null,
    regimeOverride: null,
    baseRegime: regime,
    policies: [],
    rulerSince: year - rint(h, 0, 8),
  };
  refreshContext(h, countryId, ctx, year, true);
  return ctx;
}

/** Recompute derived world-context values from baselines, history and shocks. */
export function refreshContext(h: RngHolder, countryId: string, ctx: WorldContext, year: number, snap = false): void {
  const def = COUNTRY_BY_ID[countryId];
  const hist = activeHistory(countryId, year);
  let econT = def.economy + ctx.econShock;
  let stabT = def.stability + ctx.stabShock;
  let crimeT = 0;
  let war: WarStatus = 'none';
  let warName: string | undefined;
  let crisis = false;
  let crisisName: string | undefined;
  let prohibition = ctx.policies.includes('prohibitionLaw');
  for (const ev of hist) {
    econT += ev.economy ?? 0;
    stabT += ev.stability ?? 0;
    crimeT += ev.crime ?? 0;
    if (ev.war && WAR_RANK[ev.war] > WAR_RANK[war]) {
      war = ev.war;
      warName = ev.name;
    }
    if (ev.healthCrisis) {
      crisis = true;
      crisisName = ev.name;
    }
    if (ev.prohibition) prohibition = true;
  }
  if (ctx.procWar && WAR_RANK[ctx.procWar.level] > WAR_RANK[war]) {
    war = ctx.procWar.level;
    warName = ctx.procWar.name;
  }
  if (ctx.procPandemic) {
    crisis = true;
    crisisName = ctx.procPandemic.name;
  }
  if (war === 'world') econT -= 5;
  if (war !== 'none') stabT -= WAR_RANK[war] * 4;
  econT = clamp(econT);
  stabT = clamp(stabT);
  if (snap) {
    ctx.economy = clamp(econT + normal(h, 0, 3));
    ctx.stability = clamp(stabT + normal(h, 0, 3));
  } else {
    ctx.economy = clamp(ctx.economy + (econT - ctx.economy) * 0.5 + normal(h, 0, 3));
    ctx.stability = clamp(ctx.stability + (stabT - ctx.stability) * 0.4 + normal(h, 0, 2.5));
  }
  ctx.war = war;
  ctx.warName = warName;
  ctx.healthCrisis = crisis;
  ctx.healthCrisisName = crisisName;
  ctx.prohibition = prohibition;
  ctx.cannabisLegal = (def.cannabisFrom !== undefined && year >= def.cannabisFrom) || ctx.policies.includes('legalizeCannabis');
  ctx.socialNorms = clamp(baseNorms(year) + (NORMS_OFFSET[countryId] ?? 0) + ctx.normsShift);
  const base = baseRegime(countryId, year);
  if (base !== ctx.baseRegime) {
    ctx.baseRegime = base;
    ctx.regimeOverride = null;
  }
  ctx.regime = ctx.regimeOverride ?? base;
  ctx.religionDominance = religionDominance(countryId, year, ctx.regime);
  const policyCrime = (ctx.policies.includes('crackdown') ? -8 : 0) + (ctx.policies.includes('welfare') ? -3 : 0);
  ctx.crimeRate = clamp(
    32 + (55 - ctx.economy) * 0.45 + (55 - ctx.stability) * 0.35 + WAR_RANK[war] * 4 + (prohibition ? 12 : 0) + crimeT + ctx.crimeShock + policyCrime,
  );
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(v * 10) / 10));
}

export function createWorld(h: RngHolder, year: number): WorldState {
  const contexts: Record<string, WorldContext> = {};
  for (const c of countriesAvailable(year)) contexts[c.id] = makeContext(h, c.id, year);
  const institutions = RELIGIONS.filter((r) => r.id !== 'none' && r.from <= year && (r.to === undefined || r.to >= year)).map((r) => ({
    religionId: r.id,
    name: r.institution,
    influence: rint(h, 30, 80),
    wealth: rint(h, 20, 80),
    corruption: rint(h, 10, 50),
    schismRisk: rint(h, 5, 20),
  }));
  return {
    year,
    contexts,
    chronicle: [],
    activeHistorical: HISTORY.filter((e) => year >= e.from && year <= e.to).map((e) => e.id),
    institutions,
    legends: [],
    chains: [],
  };
}

interface WorldChainDef {
  id: string;
  steps: { delay: number; title: string; text: (country: string) => string; apply: (c: WorldContext) => void }[];
}

/** Sample world event chains: one shock cascades into follow-on events. */
const WORLD_CHAINS: WorldChainDef[] = [
  {
    id: 'crash',
    steps: [
      { delay: 1, title: 'Unemployment spike', text: (n) => `Mass layoffs sweep ${n}. Petty crime and despair rise.`, apply: (c) => { c.crimeShock += 12; c.stabShock -= 6; } },
      { delay: 1, title: 'Populist surge', text: (n) => `Angry voters in ${n} turn to a populist firebrand promising to punish the elites.`, apply: (c) => { c.stabShock -= 8; c.normsShift -= 2; } },
      { delay: 2, title: 'Recovery', text: (n) => `${n}'s economy finally turns the corner.`, apply: (c) => { c.econShock += 12; c.crimeShock -= 8; } },
    ],
  },
  {
    id: 'war',
    steps: [
      { delay: 1, title: 'Refugee crisis', text: (n) => `Refugees flee the fighting in ${n}; camps overflow at the borders.`, apply: (c) => { c.stabShock -= 5; } },
      { delay: 2, title: 'Arms boom', text: (n) => `Weapons manufacturers in ${n} post record profits as the war grinds on.`, apply: (c) => { c.econShock += 4; } },
    ],
  },
  {
    id: 'pandemic',
    steps: [
      { delay: 1, title: 'Hospitals overwhelmed', text: (n) => `Hospitals in ${n} run out of beds. Lockdowns crush small businesses.`, apply: (c) => { c.econShock -= 10; c.stabShock -= 6; } },
      { delay: 2, title: 'Vaccine rollout', text: (n) => `A treatment arrives in ${n}; life slowly returns to normal.`, apply: (c) => { c.econShock += 8; } },
    ],
  },
  {
    id: 'coup',
    steps: [
      { delay: 1, title: 'Purges', text: (n) => `The new regime in ${n} purges the old elite. Journalists vanish.`, apply: (c) => { c.normsShift -= 3; c.crimeShock += 5; } },
      { delay: 3, title: 'Unrest', text: (n) => `Protests against the junta spread across ${n}.`, apply: (c) => { c.stabShock -= 10; } },
    ],
  },
];

const FUTURE_EVENTS: { title: string; text: string; apply: (c: WorldContext) => void }[] = [
  { title: 'AI automation wave', text: 'AI systems automate a vast wave of white-collar jobs. Retraining programs cannot keep up.', apply: (c) => { c.econShock += 6; c.stabShock -= 6; } },
  { title: 'Climate disaster', text: 'Record floods and heatwaves displace millions. Climate refugees head inland.', apply: (c) => { c.econShock -= 8; c.stabShock -= 6; } },
  { title: 'Autonomous weapons', text: 'Autonomous drone swarms are used in a regional war for the first time.', apply: (c) => { c.stabShock -= 4; } },
  { title: 'Gene editing legalized', text: 'Several nations legalize embryo gene editing. "Designer" children become a class marker.', apply: (c) => { c.normsShift += 1; } },
  { title: 'Fusion breakthrough', text: 'A commercial fusion plant comes online. Energy prices collapse.', apply: (c) => { c.econShock += 10; } },
  { title: 'Universal basic income', text: 'A universal basic income pilot goes national.', apply: (c) => { c.stabShock += 5; c.crimeShock -= 5; } },
  { title: 'Lunar base', text: 'The first permanent lunar settlement is established.', apply: (c) => { c.econShock += 2; } },
  { title: 'Water wars', text: 'Drought sparks fighting over river systems.', apply: (c) => { c.stabShock -= 8; } },
];

/**
 * Advance the living world by one year. The world ages independently of the
 * character: every country's context moves, history fires on schedule and the
 * procedural engine fills the gaps (and the future).
 */
export function worldTick(x: Ctx): void {
  const s = x.s;
  const w = s.world;
  const year = w.year;
  const entries: ChronicleEntry[] = [];
  const add = (countryId: string | null, title: string, text: string) => entries.push({ year, countryId, title, text });

  // New countries appear as history unfolds.
  for (const c of COUNTRIES) if (c.availableFrom <= year && !w.contexts[c.id]) w.contexts[c.id] = makeContext(s, c.id, year);

  // Scheduled history.
  for (const ev of HISTORY) {
    if (ev.from === year) {
      add(ev.scope === 'global' ? null : ev.scope.length === 1 ? ev.scope[0] : null, ev.name, ev.start);
      if (ev.norms) for (const id of Object.keys(w.contexts)) if (inScope(ev, id)) w.contexts[id].normsShift += ev.norms * HISTORY_NORMS_WEIGHT;
      if (ev.war) for (const id of Object.keys(w.contexts)) if (inScope(ev, id)) w.chains.push({ id: 'war', countryId: id, step: 0, dueYear: year + 1 });
    }
    if (ev.to === year && ev.from !== year && ev.end) add(ev.scope === 'global' ? null : ev.scope.length === 1 ? ev.scope[0] : null, `${ev.name} ends`, ev.end);
  }
  w.activeHistorical = HISTORY.filter((e) => year >= e.from && year <= e.to).map((e) => e.id);

  const historicalPandemic = HISTORY.some((e) => e.healthCrisis && year >= e.from && year <= e.to);
  if (!historicalPandemic && !Object.values(w.contexts).some((c) => c.procPandemic) && chance(s, year < 1700 ? 0.012 : 0.005)) {
    const name = year < 1900 ? pick(s, ['The Sweating Sickness', 'The Grey Plague', 'The Red Fever', 'Cholera outbreak']) : pick(s, ['Avian flu pandemic', 'The Lung Fever', 'Novel influenza H9', 'Hemorrhagic fever outbreak']);
    for (const c of Object.values(w.contexts)) c.procPandemic = { name, years: rint(s, 2, 3) };
    add(null, name, `${name} spreads across borders. Health systems brace.`);
    for (const id of Object.keys(w.contexts)) if (chance(s, 0.3)) w.chains.push({ id: 'pandemic', countryId: id, step: 0, dueYear: year + 1 });
  }

  if (year >= 2027 && chance(s, 0.25)) {
    const fe = pick(s, FUTURE_EVENTS);
    for (const c of Object.values(w.contexts)) fe.apply(c);
    add(null, fe.title, fe.text);
  }

  for (const [id, ctx] of Object.entries(w.contexts)) {
    const n = countryName(id, year);
    const N = countryNameCap(id, year);
    // Shocks decay.
    ctx.econShock *= 0.75;
    ctx.stabShock *= 0.8;
    ctx.crimeShock *= 0.8;
    if (ctx.sanctions > 0) ctx.sanctions--;
    if (ctx.procWar) {
      ctx.procWar.years--;
      if (ctx.procWar.years <= 0) {
        add(id, 'Ceasefire', `The ${ctx.procWar.name} ends in an uneasy ceasefire.`);
        ctx.procWar = null;
      }
    }
    if (ctx.procPandemic) {
      ctx.procPandemic.years--;
      if (ctx.procPandemic.years <= 0) ctx.procPandemic = null;
    }
    const histWar = activeHistory(id, year).some((e) => e.war);
    // Procedural economic shocks.
    if (chance(s, 0.035)) {
      const hit = -rint(s, 15, 30);
      ctx.econShock += hit;
      add(id, 'Recession', `${N} plunges into recession. Markets fall ${-hit}%.`);
      w.chains.push({ id: 'crash', countryId: id, step: 0, dueYear: year + 1 });
    } else if (chance(s, 0.03)) {
      ctx.econShock += rint(s, 10, 20);
      add(id, 'Economic boom', `${N} enjoys a boom. Property prices soar.`);
    }
    // Procedural wars.
    if (!histWar && !ctx.procWar && chance(s, ctx.stability < 35 ? 0.05 : 0.008)) {
      const civil = ctx.stability < 25 && chance(s, 0.5);
      ctx.procWar = { name: civil ? `${countryName(id, year)} civil war` : `border war`, years: rint(s, 1, 6), level: civil ? 'major' : 'regional' };
      add(id, civil ? 'Civil war' : 'War', civil ? `${N} collapses into civil war.` : `${N} goes to war over a border dispute.`);
      w.chains.push({ id: 'war', countryId: id, step: 0, dueYear: year + 1 });
    }
    // Coups and revolutions.
    if (ctx.stability < 25 && chance(s, ctx.regime === 'democracy' ? 0.03 : 0.07)) {
      ctx.regimeOverride = 'junta';
      ctx.ruler = newRuler(s, id, year, 'junta');
      ctx.rulerSince = year;
      ctx.stabShock += 10;
      add(id, 'Coup', `The military seizes power in ${n}. ${ctx.ruler} declares martial law.`);
      w.chains.push({ id: 'coup', countryId: id, step: 0, dueYear: year + 1 });
    } else if (ctx.stability < 18 && ['monarchy', 'autocracy', 'junta', 'empire'].includes(ctx.regime) && year > 1700 && chance(s, 0.06)) {
      ctx.regimeOverride = 'democracy';
      ctx.ruler = newRuler(s, id, year, 'democracy');
      ctx.rulerSince = year;
      ctx.stabShock += 15;
      add(id, 'Revolution', `Revolution in ${n}! The old regime falls and ${ctx.ruler} leads a new republic.`);
    }
    // Ordinary leadership change.
    const tenure = year - ctx.rulerSince;
    const changeP = ctx.regime === 'democracy' ? (tenure >= 4 ? 0.3 : 0) : ctx.regime === 'monarchy' || ctx.regime === 'empire' ? 0.04 : 0.06;
    if (chance(s, changeP)) {
      ctx.ruler = newRuler(s, id, year, ctx.regime);
      ctx.rulerSince = year;
      if (id === x.c.countryId) add(id, 'New leader', `${ctx.ruler} now leads ${n}.`);
    }
    refreshContext(s, id, ctx, year);
  }

  // World chains.
  for (const ch of w.chains) {
    if (ch.dueYear > year) continue;
    const def = WORLD_CHAINS.find((d) => d.id === ch.id);
    const ctx = w.contexts[ch.countryId];
    if (!def || !ctx) {
      ch.step = 999;
      continue;
    }
    const step = def.steps[ch.step];
    if (!step) {
      ch.step = 999;
      continue;
    }
    step.apply(ctx);
    add(ch.countryId, step.title, step.text(countryName(ch.countryId, year)));
    ch.step++;
    const next = def.steps[ch.step];
    if (next) ch.dueYear = year + next.delay;
    else ch.step = 999;
  }
  w.chains = w.chains.filter((c) => c.step < 999);

  // Religious institutions drift; schisms happen.
  for (const inst of w.institutions) {
    inst.corruption = clamp(inst.corruption + normal(s, 0.3, 2));
    inst.schismRisk = clamp(inst.schismRisk + normal(s, 0.5, 2) + (inst.corruption > 60 ? 1 : 0));
    inst.influence = clamp(inst.influence + normal(s, year > 1950 ? -0.3 : 0, 1.5));
    if (inst.schismRisk > 60 && chance(s, 0.12)) {
      add(null, 'Schism', `A schism splits ${inst.name}. Rival factions excommunicate each other.`);
      inst.influence = clamp(inst.influence - 15);
      inst.schismRisk = 10;
    }
  }

  w.chronicle.push(...entries);
  if (w.chronicle.length > 400) w.chronicle.splice(0, w.chronicle.length - 400);
  for (const e of entries) if (e.countryId === null || e.countryId === x.c.countryId) x.log(`🌍 ${e.title}: ${e.text}`, 'world');
}
