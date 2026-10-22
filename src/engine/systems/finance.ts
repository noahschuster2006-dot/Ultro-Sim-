import type { Ctx } from '../ctx';
import { CAREER_BY_ID } from '../data/careers';
import type { Character, FamilyStatus } from '../types';

export const LIFESTYLE_COST: Record<Character['lifestyle'], number> = { frugal: 6000, modest: 15000, comfortable: 32000, lavish: 110000 };

export const ALLOWANCE: Record<FamilyStatus, number> = { destitute: 0, poor: 100, working: 400, middle: 1200, wealthy: 6000, aristocracy: 12000, royalty: 30000 };

/** Prices in older eras scale down with wages so a serf's $1,500 still buys a life. */
export function eraCostFactor(year: number): number {
  if (year < 1400) return 0.25;
  if (year < 1700) return 0.3;
  if (year < 1900) return 0.45;
  if (year < 1950) return 0.7;
  if (year < 1990) return 0.9;
  return 1;
}

export function livingCost(x: Ctx): number {
  const c = x.c;
  if (c.age < 18 || c.legal.prison) return 0;
  let cost = LIFESTYLE_COST[c.lifestyle] * eraCostFactor(x.year);
  if (c.flags.livingWithParents && x.aliveParents().length) cost *= 0.3;
  return Math.round(cost);
}

/** Yearly household finances: allowance, living costs, spouse income, debt. */
export function financeTick(x: Ctx): void {
  const c = x.c;
  if (c.age >= 13 && c.age < 18 && x.aliveParents().length) x.money(Math.round(ALLOWANCE[c.familyStatus] * eraCostFactor(x.year)));
  if (c.age < 18) return;
  let cost = livingCost(x);
  const sp = x.spouse();
  if (sp && !c.legal.prison) {
    const npc = x.npc(sp.npcId);
    if (npc?.career) cost -= Math.round(Math.min(cost * 0.8, 15000 * eraCostFactor(x.year)));
  }
  if (c.flags.childSupport) cost += c.flags.childSupport as number;
  if (cost > 0) {
    if (c.money >= cost) c.money -= cost;
    else {
      let short = cost - Math.max(0, c.money);
      c.money = 0;
      if (c.crime.dirtyMoney > 0) {
        const use = Math.min(short, c.crime.dirtyMoney);
        c.crime.dirtyMoney -= use;
        short -= use;
        x.mod('heat', use / 25000);
      }
      if (short > 0) {
        c.debt += short;
        x.mods({ stress: 5, anxiety: 3 });
        if (c.lifestyle !== 'frugal') {
          c.lifestyle = c.lifestyle === 'lavish' ? 'comfortable' : c.lifestyle === 'comfortable' ? 'modest' : 'frugal';
          x.log(`You could not afford your lifestyle and had to downgrade to ${c.lifestyle}.`, 'bad');
        }
      }
    }
  }
  const effects = { frugal: { happiness: -1.5 }, modest: {}, comfortable: { happiness: 1.5 }, lavish: { happiness: 3, fame: 0.5, looks: 0.5 } }[c.lifestyle];
  x.mods(effects);
  // Debt.
  if (c.debt > 0) {
    c.debt = Math.round(c.debt * (x.year < 1900 ? 1.12 : 1.08));
    const pay = Math.min(c.debt, Math.max(0, c.money) * 0.3);
    c.debt -= Math.round(pay);
    c.money -= Math.round(pay);
    if (c.debt > 20000) x.mod('stress', Math.min(8, c.debt / 20000));
    const lastBk = (c.flags.lastBankruptcy as number) ?? -99;
    if ((c.debt > Math.max(60000, x.netWorth() + c.debt) * 0.9 || c.flags.bankruptcyPending) && c.money < 2000 && c.age - lastBk > 7 && !x.queued('bankruptcy')) {
      c.flags.bankruptcyPending = false;
      x.queue('bankruptcy');
    }
  }
}

/** General passive stat feedback not owned by a specific system. */
export function statsTick(x: Ctx): void {
  const c = x.c;
  const criminalActive = !!(c.career && CAREER_BY_ID[c.career.careerId]?.tags.includes('criminal')) || c.crime.operations.length > 0 || !!c.crime.orgName;
  if (!criminalActive) x.mods({ criminalRep: -1, streetCred: -0.8 });
  x.mod('fear', -2);
  if (!c.politics.office) x.mod('corruption', -1);
  if (!c.career && c.age > 22) x.mod('professionalRep', -0.8);
  x.mod('confidence', (50 - x.stat('confidence')) * 0.04);
  if (c.age >= 13 && c.age < 18) x.mod('popularity', (50 - x.stat('popularity')) * 0.05);
  if (x.stat('happiness') < 15) x.mod('health', -1.5);
  if (x.stat('happiness') > 80) x.mod('immunity', 0.5);
  if (x.stat('fitness') > 70) x.mod('health', 0.8);
  // Running averages for the lifespan formula.
  c.totals.years++;
  c.totals.happiness += x.stat('happiness');
  c.totals.health += x.stat('health');
}
