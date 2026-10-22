import type { Ctx } from '../ctx';
import { CHRONIC, CHRONIC_BY_ID, INJURIES } from '../data/conditions';
import { COUNTRY_BY_ID } from '../data/countries';
import { eraOf } from '../data/eras';
import type { StatId } from '../data/stats';
import type { Character } from '../types';

export function bmi(c: Character): number {
  const m = c.bio.heightCm / 100;
  return Math.round((c.bio.weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(c: Character): 'underweight' | 'healthy' | 'overweight' | 'obese' {
  if (c.age < 16) return 'healthy';
  const b = bmi(c);
  if (b < 18.5) return 'underweight';
  if (b < 25) return 'healthy';
  if (b < 30) return 'overweight';
  return 'obese';
}

/** Visible body changes across life stages. */
export function bodyDescriptor(x: Ctx): string {
  const c = x.c;
  const cat = bmiCategory(c);
  const fit = x.stat('fitness');
  if (c.age < 3) return cat === 'underweight' ? 'a frail baby' : 'a chubby-cheeked baby';
  if (c.age < 13) return fit > 60 ? 'a wiry, energetic kid' : cat === 'overweight' || cat === 'obese' ? 'a round-faced kid' : 'a gangly kid';
  if (c.age < 18) return c.bio.heightCm > 180 ? 'a lanky teen' : fit > 65 ? 'an athletic teen' : 'an awkward teen';
  const scars = c.bio.injuries.length ? ', scarred' : '';
  const tattoos = c.bio.cosmetics.some((m) => m.id === 'tattoo') ? ', tattooed' : '';
  let base: string;
  if (c.age >= 80) base = 'a stooped elder';
  else if (c.age >= 60) base = fit > 55 ? 'a spry senior' : 'a greying senior';
  else if (cat === 'obese') base = 'heavyset';
  else if (cat === 'underweight') base = 'gaunt';
  else if (fit > 75) base = 'chiseled and athletic';
  else if (fit > 55) base = 'fit';
  else base = 'average build';
  return `${base}${scars}${tattoos}`;
}

export function injure(x: Ctx, combat: boolean, id?: string): string {
  const options = INJURIES.filter((i) => !x.c.bio.injuries.some((j) => j.id === i.id));
  const inj = (id ? INJURIES.find((i) => i.id === id) : undefined) ?? (options.length ? x.pick(options) : INJURIES[0]);
  x.c.bio.injuries.push({ id: inj.id, name: inj.name, age: x.age, combat });
  // Injury penalties stack: each one lowers the permanent ceiling further.
  for (const [k, v] of Object.entries(inj.caps) as [StatId, number][]) {
    const cap = Math.max(30, (x.c.bio.caps[k] ?? 100) - (100 - v));
    x.c.bio.caps[k] = cap;
    if (x.c.stats[k] > cap) x.c.stats[k] = cap;
  }
  x.mods({ pain: 15, health: -8, happiness: -5 });
  x.remember('injury', `Suffered a ${inj.name.toLowerCase()}`, 30);
  return `${inj.name} (${inj.desc}).`;
}

export function diagnose(x: Ctx, id: string, inherited = false): boolean {
  if (x.c.bio.chronic.some((ch) => ch.id === id)) return false;
  const def = CHRONIC_BY_ID[id];
  if (!def) return false;
  if (def.fromYear && x.year < def.fromYear) return false;
  x.c.bio.chronic.push({ id, severity: 1, diagnosedAge: x.age, managed: false, inherited });
  x.log(`🩺 Diagnosed with ${def.name}.`, 'bad');
  x.remember('diagnosis', `Diagnosed with ${def.name}`, 40);
  x.mods({ happiness: -8, anxiety: 6 });
  return true;
}

export function wealthPercentile(x: Ctx): number {
  const nw = x.netWorth();
  if (nw <= 0) return 0;
  return Math.max(0, Math.min(100, Math.log10(nw + 1) * 14 - 26));
}

export interface LifespanBreakdown {
  base: number;
  health: number;
  addiction: number;
  chronic: number;
  happiness: number;
  wealth: number;
  combat: number;
  other: number;
  random: number;
  final: number;
}

/**
 * The life expectancy formula from the design bible:
 *   base = 72 + genetics + country modifier
 *   + (health_avg - 50) * 0.3 - addiction_severity * 2 - chronic * 3
 *   + (happiness_avg - 50) * 0.15 + wealth_percentile * 0.1 - combat_injuries * 1.5
 *   clamp(base + modifier + random(-8, 8), 18, 115)
 */
export function lifespan(x: Ctx): LifespanBreakdown {
  const c = x.c;
  const country = COUNTRY_BY_ID[c.countryId];
  const countryMod = (country?.lifespanModifier ?? 0) + eraOf(x.year).lifespanModifier;
  const base = 72 + c.lifespan.geneticsBonus + countryMod;
  const years = Math.max(1, c.totals.years);
  const healthAvg = c.totals.years ? c.totals.health / years : c.stats.health;
  const happyAvg = c.totals.years ? c.totals.happiness / years : c.stats.happiness;
  const health = (healthAvg - 50) * 0.3;
  const addiction = -c.addictions.filter((a) => a.active).reduce((t, a) => t + a.severity * 2, 0);
  const chronic = -c.bio.chronic.length * 3;
  const happiness = (happyAvg - 50) * 0.15;
  const wealth = wealthPercentile(x) * 0.1;
  const combat = -c.bio.injuries.filter((i) => i.combat).length * 1.5;
  let other = 0;
  if (x.blessing('vitality')) other += 3;
  other -= ((c.flags.pactYears as number) || 0) * 20;
  other += ((c.flags.graftedYears as number) || 0);
  if (c.traits.includes('longLived')) other += 4;
  if (c.traits.includes('frail')) other -= 4;
  const final = Math.max(18, Math.min(115, Math.round(base + health + addiction + chronic + happiness + wealth + combat + other + c.lifespan.offset)));
  return { base, health, addiction, chronic, happiness, wealth, combat, other, random: c.lifespan.offset, final };
}

/** Weight drifts toward a set point defined by diet, exercise, age and drugs. */
function targetBmi(x: Ctx): number {
  const c = x.c;
  let t = 22;
  if (c.diet === 'excessive') t += 8;
  if (c.diet === 'healthy') t -= 1.5;
  if (c.diet === 'poor') t += c.familyStatus === 'destitute' || c.money < 1000 ? -3.5 : 3;
  t -= c.exercise * 0.9;
  if (c.age >= 30 && c.age < 65) t += 2;
  if (c.age >= 80) t -= 1.5;
  if (c.addictions.some((a) => a.active && (a.kind === 'stimulants' || a.kind === 'opioids'))) t -= 3;
  if (c.addictions.some((a) => a.active && a.kind === 'alcohol')) t += 1.5;
  if (c.bio.bodyType === 'endomorph') t += 1.5;
  if (c.bio.bodyType === 'ectomorph') t -= 1.5;
  return t;
}

/** Health regenerates toward a target set by age, fitness, lifestyle and disease. */
export function healthTarget(x: Ctx): number {
  const c = x.c;
  let t = 96 - Math.max(0, c.age - 35) * 0.8;
  t += (x.stat('fitness') - 50) / 6;
  if (c.diet === 'healthy') t += 3;
  if (c.diet === 'excessive') t -= 5;
  if (c.diet === 'poor') t -= 4;
  const cat = bmiCategory(c);
  if (cat === 'obese') t -= 8;
  if (cat === 'underweight') t -= 6;
  if (x.stat('stress') > 70) t -= 5;
  if (x.stat('happiness') < 20) t -= 4;
  for (const ch of c.bio.chronic) t -= (ch.managed ? 1.5 : 4) * ch.severity;
  if (c.bio.steroidYears > 0) t -= 6;
  if (x.blessing('vitality')) t += 6;
  return Math.max(5, Math.min(100, t));
}

/** Yearly biology: growth, weight, aging, chronic disease, injuries and fertility. */
export function bodyTick(x: Ctx): void {
  const c = x.c;
  const age = c.age;
  const adult = (c.flags.adultHeight as number) || c.bio.heightCm;
  if (age <= 18) {
    const t = Math.min(1, age / 18);
    c.bio.heightCm = Math.round(50 + (adult - 50) * Math.pow(t, 0.7));
    const healthyBmi = 15.5 + t * 6;
    c.bio.weightKg = Math.round(healthyBmi * Math.pow(c.bio.heightCm / 100, 2) + (c.diet === 'excessive' ? t * 8 : 0));
  } else {
    const h2 = Math.pow(c.bio.heightCm / 100, 2);
    const target = targetBmi(x) * h2;
    c.bio.weightKg = Math.max(35, Math.round((c.bio.weightKg + (target - c.bio.weightKg) * 0.18 + x.float(-1.5, 1.5)) * 10) / 10);
    if (age > 70) c.bio.heightCm = Math.max(adult - 6, c.bio.heightCm - 0.2);
  }
  const cat = bmiCategory(c);
  if (cat === 'obese') x.mods({ fitness: -1.5, looks: -1, energy: -2 });
  if (cat === 'underweight') x.mods({ immunity: -2, fitness: -1 });

  // Fitness, looks, health and energy across the lifespan.
  const ex = c.exercise;
  x.mod('fitness', (ex - 1) * 1.8 - (age > 30 ? 0.6 : 0) - (age > 60 ? 1.4 : 0) + (age < 18 ? 1.5 : 0));
  if (!c.flags.pactBeauty) x.mod('looks', age > 35 ? -0.6 - (age > 60 ? 0.6 : 0) : age < 20 ? 0.6 : 0);
  x.mod('health', (healthTarget(x) - x.stat('health')) * 0.15);
  x.mod('energy', age < 25 ? 2 : age > 40 ? -1 - (age - 40) * 0.03 : 0);
  if (age > 60) x.mod('immunity', -1);
  x.mod('pain', c.bio.injuries.length ? -1 : -4);
  if (c.bio.steroidYears > 0) {
    c.bio.steroidYears++;
    x.mod('aggression', 1.5);
  }
  // Fertility.
  if (age > 30) x.mod('fertility', c.gender === 'female' ? -3.5 : -1);
  if (c.gender === 'female' && age >= 50) x.set('fertility', 0);

  // Chronic disease onset.
  const p = c.bio.predisposition;
  const b = bmi(c);
  const stress = x.stat('stress');
  const has = (id: string) => c.bio.chronic.some((ch) => ch.id === id);
  if (age > 30 && !has('diabetes') && x.chance((b > 30 ? 0.012 : 0.002) * (1 + p.diabetes * 3))) diagnose(x, 'diabetes');
  if (age > 40 && !has('heartDisease') && x.chance(((age - 40) / 3000 + (b > 30 ? 0.006 : 0) + stress / 20000) * (1 + p.heart * 3) * (c.addictions.some((a) => a.active && a.kind === 'stimulants') ? 2 : 1))) diagnose(x, 'heartDisease');
  if (age > 35 && !has('hypertension') && x.chance(0.004 + stress / 15000)) diagnose(x, 'hypertension');
  if (age > 45 && !has('cancer') && x.chance(((age - 45) / 4000) * (1 + p.cancer * 3))) diagnose(x, 'cancer');
  if (age > 60 && !has('arthritis') && x.chance(0.02)) diagnose(x, 'arthritis');
  if (c.addictions.some((a) => a.kind === 'alcohol' && a.severity >= 4) && !has('liverDisease') && x.chance(0.15)) diagnose(x, 'liverDisease');
  if (c.career?.careerId === 'miner' && !has('copd') && x.chance(0.02)) diagnose(x, 'copd');
  if (x.year < 1950 && (c.familyStatus === 'destitute' || c.familyStatus === 'poor') && !has('tuberculosis') && x.chance(0.006)) diagnose(x, 'tuberculosis');
  if (age > 68 && !has('dementia') && x.s.settings.dementiaPath && x.chance(((age - 68) / 400) * (1 + p.dementia * 4))) {
    diagnose(x, 'dementia');
    c.mental.dementiaStage = 1;
  }
  if (c.flags.huntington && age >= 40 && !has('huntington')) diagnose(x, 'huntington', true);

  // Chronic disease management and progression.
  for (const ch of c.bio.chronic) {
    const def = CHRONIC_BY_ID[ch.id];
    if (!def) continue;
    if (ch.managed) {
      if (!x.spend(def.cost)) {
        ch.managed = false;
        x.log(`💊 You could not afford treatment for ${def.name}.`, 'bad');
      } else if (x.chance(0.08) && ch.id !== 'dementia' && ch.id !== 'huntington' && ch.id !== 'hiv') {
        ch.severity = Math.max(1, ch.severity - 1);
      }
    }
    if (!ch.managed) {
      x.mod('health', -def.drain * ch.severity * 0.5);
      if (x.chance(0.25)) ch.severity = Math.min(5, ch.severity + 1);
    }
    if (ch.id === 'arthritis') x.mod('pain', 4);
  }
  // Cancer can go into remission when treated.
  const cancer = c.bio.chronic.find((ch) => ch.id === 'cancer');
  if (cancer && cancer.managed && x.chance(0.25)) {
    c.bio.chronic = c.bio.chronic.filter((ch) => ch !== cancer);
    x.log('🎗️ Your cancer is in remission.', 'good');
    x.mods({ happiness: 15, faith: 2 });
    x.remember('survivedCancer', 'Beat cancer', 45);
  }
  const tb = c.bio.chronic.find((ch) => ch.id === 'tuberculosis');
  if (tb && x.year >= 1946 && tb.managed && x.chance(0.6)) {
    c.bio.chronic = c.bio.chronic.filter((ch) => ch !== tb);
    x.log('Antibiotics cured your tuberculosis.', 'good');
  }
}

export function chronicMortality(x: Ctx): number {
  let p = 0;
  for (const ch of x.c.bio.chronic) {
    const def = CHRONIC_BY_ID[ch.id];
    if (def) p += def.mortality * (ch.managed ? 0.35 : 1) * (0.6 + ch.severity * 0.25);
  }
  return p;
}

export const CHRONIC_LIST = CHRONIC;
