import type { Ctx } from '../ctx';
import { CAREERS, CAREER_BY_ID, careerTitle, type CareerDef } from '../data/careers';
import { COMPANY_WORDS_A, COMPANY_WORDS_B } from '../data/names';
import { RELIGION_BY_ID } from '../data/countries';
import { injure } from './body';
import { aOrAn, makeNpc } from './npcs';

export function careerDef(x: Ctx): CareerDef | undefined {
  return x.c.career ? CAREER_BY_ID[x.c.career.careerId] : undefined;
}

export function currentTitle(x: Ctx): string {
  const c = x.c;
  if (c.legal.prison) return 'Inmate';
  if (!c.career) {
    if (c.education.enrolled) return 'Student';
    if (c.retired) return 'Retired';
    if (c.age < 6) return 'Child';
    if (c.age < 18) return 'Student';
    return 'Unemployed';
  }
  const def = CAREER_BY_ID[c.career.careerId];
  return def ? careerTitle(def, c.career.level, !!c.career.branch) : 'Worker';
}

export function salaryFor(x: Ctx, def: CareerDef, level: number, branch: boolean): number {
  const mult = branch && def.branch && level >= def.branch.at ? def.branch.salaryMult : 1;
  const economy = 0.8 + (x.w?.economy ?? 50) / 250;
  return Math.round(def.salary * Math.pow(def.growth, level - 1) * mult * economy);
}

function employerName(x: Ctx, def: CareerDef): string {
  const country = x.countryName;
  if (def.tags.includes('military')) return `the armed forces of ${country}`;
  if (def.tags.includes('police')) return def.id === 'spy' ? 'the national intelligence service' : def.id === 'federalAgent' ? 'the federal bureau' : 'the city police';
  if (def.tags.includes('religious')) return RELIGION_BY_ID[x.c.religionId]?.institution || 'the temple';
  if (def.tags.includes('royal')) return 'the Crown';
  if (def.tags.includes('criminal')) return x.c.crime.orgName ?? 'a street crew';
  if (def.cat === 'politics') return 'the movement';
  if (x.year < 1750) return x.pick(['a local master', 'the town guild', 'a noble household', 'the market square']);
  return `${x.pick(COMPANY_WORDS_A)} ${x.pick(COMPANY_WORDS_B)}`;
}

/** Returns true when the career is open to you, or the reason it is not. */
export function careerEligibility(x: Ctx, def: CareerDef): true | string {
  const c = x.c;
  if (x.year < def.years[0] || x.year > def.years[1]) return 'Not available in this era';
  if (c.legal.prison) return 'You are in prison';
  if (def.special === 'succession') return 'Inherited through royal succession only';
  if (def.special === 'election') return 'Run for office in the Politics panel';
  if (def.special === 'pact') return c.spiritual.soulSold ? true : 'Requires selling your soul';
  if (def.id === 'controversyCommentator' && !c.flags.survivedCancel) return 'Requires surviving a cancellation';
  if (def.countries && !def.countries.includes(c.countryId)) return 'Not available in this country';
  if (def.family && !def.family.includes(c.familyStatus)) return `Requires ${def.family.join('/')} birth`;
  const minAge = def.minAge ?? 18;
  if (c.age < minAge) return `Minimum age ${minAge}`;
  if (def.maxStartAge && c.age > def.maxStartAge) return `Too old to start (max ${def.maxStartAge})`;
  if (def.edu && !def.edu.some((e) => c.education.completed.includes(e))) return `Requires: ${def.edu.join(' or ')}`;
  for (const [k, v] of Object.entries(def.min ?? {})) if (x.stat(k as keyof typeof c.stats) < (v as number)) return `Requires ${k} ${v}+`;
  for (const [k, v] of Object.entries(def.max ?? {})) if (x.stat(k as keyof typeof c.stats) > (v as number)) return `Requires ${k} below ${v}`;
  for (const [k, v] of Object.entries(def.skills ?? {})) if (x.skill(k) < v) return `Requires skill ${k} ${v}+`;
  if (def.prior && !def.prior.some((p) => c.careerHistory.some((h) => h.careerId === p) || c.career?.careerId === p)) return `Requires prior career: ${def.prior.map((p) => CAREER_BY_ID[p]?.name ?? p).join(' / ')}`;
  if (def.minHeight && c.bio.heightCm < def.minHeight) return `Requires height ${def.minHeight}cm+`;
  if (def.maxHeight && c.bio.heightCm > def.maxHeight) return `Requires height under ${def.maxHeight}cm`;
  if (def.needsWar && x.w.war === 'none') return 'Only available during wartime';
  if (def.trad && c.gender !== def.trad && x.w.socialNorms < 35) return `Society in this era bars ${c.gender === 'female' ? 'women' : 'men'} from this role`;
  if (def.capital && c.money < def.capital) return `Requires ${x.fmt(def.capital)} capital`;
  const clean = ['police', 'legal'].some((t) => def.tags.includes(t as never)) || def.id === 'teacher' || def.id === 'militaryOfficer' || def.id === 'spy';
  if (clean && !def.tags.includes('criminal') && c.legal.record.some((r) => r.years >= 1)) return 'Your criminal record disqualifies you';
  if (c.career?.careerId === def.id) return 'Already in this career';
  return true;
}

export function visibleCareers(x: Ctx): CareerDef[] {
  // Secret careers stay hidden until their skill combo (or pact) unlocks them.
  return CAREERS.filter((d) => x.year >= d.years[0] && x.year <= d.years[1] && (d.cat !== 'secret' || careerEligibility(x, d) === true));
}

export function applyForJob(x: Ctx, id: string): { ok: boolean; text: string } {
  const def = CAREER_BY_ID[id];
  if (!def) return { ok: false, text: 'Unknown career.' };
  const elig = careerEligibility(x, def);
  if (elig !== true) return { ok: false, text: elig };
  const c = x.c;
  let p = 0.55;
  for (const [k, v] of Object.entries(def.min ?? {})) p += (x.stat(k as keyof typeof c.stats) - (v as number)) / 200;
  p += x.stat('professionalRep') / 300 + x.skill('networking') / 400 + x.stat('charisma') / 500;
  if (c.spiritual.societies.includes('compassLodge')) p += 0.15;
  if (c.bio.cosmetics.some((m) => m.id === 'tattoo') && ['business', 'legal'].includes(def.cat) && x.w.socialNorms < 75) p -= 0.25;
  if (c.legal.juvenileRecord && !def.tags.includes('criminal')) p -= 0.08;
  if (c.legal.record.length && !def.tags.includes('criminal')) p -= 0.15;
  if (x.stat('infamy') > 50 && !def.tags.includes('criminal')) p -= 0.15;
  if (def.tags.includes('criminal')) p = 0.6 + x.stat('streetCred') / 200 + x.stat('criminalRep') / 200;
  if (def.cat === 'secret') p = 0.9;
  if (x.w.economy < 30 && !def.tags.includes('criminal')) p -= 0.15;
  p = Math.max(0.08, Math.min(0.95, p));
  if (!x.chance(p)) {
    x.mod('confidence', -2);
    return { ok: false, text: `You applied to be ${aOrAn(def.ladder[0])} ${def.ladder[0]} but were rejected.` };
  }
  if (def.capital) x.spend(def.capital);
  startCareer(x, def);
  return { ok: true, text: `You were hired as ${currentTitle(x)} at ${c.career!.employer}. Salary: ${x.fmt(c.career!.salary)}/yr.` };
}

export function startCareer(x: Ctx, def: CareerDef, level = 1): void {
  const c = x.c;
  if (c.career) endCareer(x, 'Changed careers');
  const prev = c.careerHistory.filter((h) => h.careerId === def.id).length;
  const startLevel = Math.min(10, level + (prev ? 1 : 0));
  c.career = {
    careerId: def.id,
    level: startLevel,
    yearsInRole: 0,
    yearsInCareer: 0,
    performance: 55,
    salary: salaryFor(x, def, startLevel, false),
    employer: employerName(x, def),
    workEthic: 'normal',
  };
  c.retired = false;
  if (def.cat !== 'royalty' && def.cat !== 'secret' && x.age >= 16) {
    const boss = makeNpc(x, { age: Math.max(28, x.age + x.int(5, 20)), career: def.id, careerLevel: Math.min(10, startLevel + x.int(2, 4)) });
    x.addRel(boss.id, 'boss', { affinity: 50, trust: 45 });
    c.career.bossId = boss.id;
    if (x.chance(0.7)) {
      const col = makeNpc(x, { age: Math.max(18, x.age + x.int(-5, 8)), career: def.id, careerLevel: startLevel });
      x.addRel(col.id, 'colleague', { affinity: 50, trust: 50 });
    }
  }
  x.remember('newCareer', `Started as ${currentTitle(x)}`, 20);
}

export function endCareer(x: Ctx, reason: string): void {
  const c = x.c;
  if (!c.career) return;
  const def = CAREER_BY_ID[c.career.careerId];
  c.careerHistory.push({
    careerId: c.career.careerId,
    title: def ? careerTitle(def, c.career.level, !!c.career.branch) : c.career.careerId,
    fromAge: c.age - c.career.yearsInCareer,
    toAge: c.age,
    reason,
  });
  for (const r of c.relationships) if (r.type === 'boss' || r.type === 'colleague') r.type = 'acquaintance';
  c.career = null;
}

export function promote(x: Ctx): string | null {
  const c = x.c;
  const def = careerDef(x);
  if (!c.career || !def || c.career.level >= 10) return null;
  c.career.level++;
  c.career.yearsInRole = 0;
  c.career.salary = salaryFor(x, def, c.career.level, !!c.career.branch);
  c.career.performance = Math.max(45, c.career.performance - 15);
  x.mods({ happiness: 6, confidence: 4, professionalRep: 4 });
  if (def.tags.includes('criminal')) x.mods({ criminalRep: 5, streetCred: 3 });
  const title = currentTitle(x);
  if (c.career.level >= 8) x.remember('careerApex', `Reached ${title}`, 50 + c.career.level * 3);
  if (c.career.level === 10) x.mod('ego', 8);
  return title;
}

/** Yearly career simulation: pay, performance, promotions, firings, injuries. */
export function careerTick(x: Ctx): void {
  const c = x.c;
  const cs = c.career;
  if (!cs) {
    // Pensions for long careers.
    if (c.retired) {
      const best = c.flags.pension as number;
      if (best) x.money(best);
    }
    return;
  }
  const def = CAREER_BY_ID[cs.careerId];
  if (!def) {
    c.career = null;
    return;
  }
  if (x.year > def.years[1]) {
    endCareer(x, 'Era ended');
    x.log(`The world moved on: being a ${def.name.toLowerCase()} is no longer possible. You are out of work.`, 'bad');
    return;
  }
  if (def.needsWar && x.w.war === 'none') {
    endCareer(x, 'War ended');
    x.log(`Peace has come. Your ${def.name.toLowerCase()} days are over.`, 'neutral');
    return;
  }
  cs.yearsInRole++;
  cs.yearsInCareer++;
  const ethic = cs.workEthic === 'hard' ? 8 : cs.workEthic === 'slack' ? -8 : 0;
  const perfDelta = (x.stat('discipline') - 50) / 8 + (x.stat('smarts') - 50) / 20 + ethic + x.float(-6, 6) - (x.stat('stress') > 70 ? 5 : 0) - (x.stat('energy') < 30 ? 4 : 0);
  cs.performance = Math.max(0, Math.min(100, cs.performance + perfDelta));
  if (cs.workEthic === 'hard') x.mods({ stress: 4, energy: -2 });
  if (cs.workEthic === 'slack') x.mods({ stress: -3, happiness: 1 });

  // Pay. Criminal income is dirty and has to be laundered.
  const pay = salaryFor(x, def, cs.level, !!cs.branch);
  cs.salary = pay;
  if (def.tags.includes('criminal') && def.cat !== 'secret') {
    c.crime.dirtyMoney += pay;
  } else if (def.cat === 'secret' && def.tags.includes('criminal')) {
    x.money(pay * 0.6);
    c.crime.dirtyMoney += pay * 0.4;
  } else {
    const tax = x.year >= 1914 ? 0.22 : 0.08;
    x.money(pay * (1 - tax));
  }

  for (const sk of def.trains) x.train(sk, 2.5 + cs.level * 0.25);
  if (cs.branch && def.branch) for (const sk of def.branch.trains) x.train(sk, 3);
  if (def.yearly) x.mods(def.yearly);
  if (cs.branch && def.branch?.effects) x.mods(def.branch.effects);
  if (def.heat) {
    let heat = def.heat * (0.7 + x.w.crimeRate / 150);
    if (c.flags.mobCounsel) heat *= 0.5;
    x.mod('heat', heat);
    x.mod('criminalRep', 2);
  }
  if (def.fame) x.mod('fame', def.fame * (0.5 + cs.level / 10));
  if (def.tags.includes('fame') && cs.level >= 6) x.mod('fame', 1.5);
  x.mod('professionalRep', cs.performance > 60 ? 1.5 : cs.performance < 30 ? -2 : 0.3);
  if (def.injury && x.chance(def.injury * (cs.workEthic === 'hard' ? 1.3 : 1))) {
    const what = injure(x, def.tags.includes('military'));
    x.log(`💥 Injured on the job: ${what}`, 'bad');
  }

  // Promotion.
  const promoteP = cs.performance > 70 && cs.yearsInRole >= 1 ? 0.25 + (cs.performance - 70) / 100 + (cs.workEthic === 'hard' ? 0.1 : 0) : 0;
  if (cs.level < 10 && x.chance(promoteP)) {
    if (def.branch && cs.level + 1 === def.branch.at && !c.flags[`branchAsked_${def.id}`]) {
      c.flags[`branchAsked_${def.id}`] = true;
      x.queue('career_branch', { careerId: def.id });
    }
    const title = promote(x);
    if (title) x.log(`📈 Promoted to ${title}! New salary ${x.fmt(c.career!.salary)}.`, 'good');
  }
  // Firing and layoffs.
  if (c.career && !def.tags.includes('royal') && !def.special) {
    const fireP = cs.performance < 15 ? 0.35 : cs.performance < 25 ? 0.1 : 0;
    const layoffP = x.w.economy < 30 && !def.tags.includes('criminal') ? 0.06 : 0.01;
    if (x.chance(fireP)) {
      endCareer(x, 'Fired');
      x.log(`🔥 You were fired from your job for poor performance.`, 'bad');
      x.mods({ happiness: -10, confidence: -8, professionalRep: -8 });
      x.remember('fired', 'Got fired', 25);
    } else if (x.chance(layoffP)) {
      endCareer(x, 'Laid off');
      x.log(`📉 You were laid off as the economy struggles.`, 'bad');
      x.mods({ happiness: -8, stress: 8 });
    }
  }
}

export function retire(x: Ctx): string {
  const c = x.c;
  const cs = c.career;
  if (!cs) return 'You have no job to retire from.';
  const def = CAREER_BY_ID[cs.careerId];
  const years = c.careerHistory.reduce((t, h) => t + (h.toAge - h.fromAge), 0) + cs.yearsInCareer;
  const pension = def && !def.tags.includes('criminal') && x.year >= 1890 ? Math.round(cs.salary * Math.min(0.6, years / 60)) : 0;
  endCareer(x, 'Retired');
  c.retired = true;
  c.flags.pension = pension;
  x.mods({ happiness: 8, stress: -15 });
  return pension ? `You retired. Pension: ${x.fmt(pension)}/yr.` : 'You retired. There is no pension.';
}

export { careerTitle };
