import type { Ctx } from '../ctx';
import { ASSETS, ASSET_BY_ID, assetName, type AssetDef } from '../data/assets';
import { hashString } from '../rng';
import type { Asset } from '../types';
import { aOrAn } from './npcs';

/** Deterministic listing price for this year so the market does not reshuffle on every render. */
export function listingPrice(x: Ctx, def: AssetDef): number {
  if (def.cat === 'investment') return 0;
  const h = (hashString(`${x.s.seed}:${def.id}:${x.year}`) % 1000) / 1000;
  const base = def.price[0] + (def.price[1] - def.price[0]) * h;
  return Math.round((base * (0.65 + x.w.economy / 145)) / 1000) * 1000;
}

export function assetEligibility(x: Ctx, def: AssetDef): true | string {
  const c = x.c;
  if (def.notForSale) return def.acquire;
  if (x.year < def.fromYear || (def.toYear && x.year > def.toYear)) return 'Not available in this era';
  if (c.age < 18) return 'You must be an adult';
  if (c.legal.prison) return 'You are in prison';
  const n = def.needs;
  if (n?.fame && x.stat('fame') < n.fame) return `Requires fame ${n.fame}+`;
  if (n?.criminalRep && x.stat('criminalRep') < n.criminalRep) return `Requires criminal rep ${n.criminalRep}+`;
  if (n?.license && x.stat('corruption') < 30 && x.stat('criminalRep') < 50 && x.stat('politicalApproval') < 60) return 'Requires a gaming license (political pull) or criminal muscle';
  if (n?.skills) for (const [k, v] of Object.entries(n.skills)) if (x.skill(k) < v) return `Requires ${k} ${v}+`;
  if (def.id === 'armsManufacturing') {
    const careers = [...c.careerHistory.map((h) => h.careerId), c.career?.careerId ?? ''];
    const connected = careers.some((id) => /soldier|militaryOfficer|specialForces|armsDealer|warProfiteer/.test(id));
    if (!connected && x.stat('criminalRep') < 50) return 'Requires a military or criminal connection';
  }
  return true;
}

export function mortgageAvailable(x: Ctx, def: AssetDef): boolean {
  return x.year >= 1900 && def.cat === 'property' && x.c.age >= 18 && !x.c.legal.prison && x.netWorth() > -50000;
}

export function buyAsset(x: Ctx, typeId: string, o: { mortgage?: boolean; amount?: number; dirty?: boolean } = {}): string {
  const def = ASSET_BY_ID[typeId];
  if (!def) return 'Unknown asset.';
  const elig = assetEligibility(x, def);
  if (elig !== true) return elig;
  const c = x.c;
  const price = def.cat === 'investment' ? Math.max(1000, Math.round(o.amount ?? 10000)) : listingPrice(x, def);
  let mortgage = 0;
  let pay = price;
  if (o.mortgage && mortgageAvailable(x, def)) {
    pay = Math.round(price * 0.2);
    mortgage = price - pay;
  }
  if (o.dirty) {
    if (c.crime.dirtyMoney < pay) return 'Not enough dirty cash.';
    c.crime.dirtyMoney -= pay;
    x.mod('heat', pay / 40000);
  } else if (!x.spend(pay)) {
    return `You need ${x.fmt(pay)}${mortgage ? ' for the down payment' : ''}.`;
  }
  const existing = def.cat === 'investment' ? c.assets.find((a) => a.typeId === typeId) : undefined;
  if (existing) {
    existing.value += price;
    existing.purchasePrice += price;
    return `You invested another ${x.fmt(price)} in ${assetName(def, x.year).toLowerCase()}.`;
  }
  const a: Asset = {
    id: x.uid('a'),
    typeId,
    name: assetName(def, x.year),
    countryId: c.countryId,
    boughtYear: x.year,
    purchasePrice: price,
    value: price,
    mortgage,
    rentedOut: false,
    condition: 85,
    level: 1,
    front: typeId === 'drugFront',
    seized: false,
    meta: {},
  };
  if (typeId === 'techStartup') a.meta.stage = 'seed';
  c.assets.push(a);
  if (typeId === 'privateIsland') x.mods({ fame: 6, happiness: 10, ego: 5 });
  x.remember('bigPurchase', `Bought ${a.name.toLowerCase()}`, Math.min(40, 10 + Math.log10(price) * 3));
  return `You bought ${aName(a.name)} for ${x.fmt(price)}${mortgage ? ` with a ${x.fmt(mortgage)} mortgage` : ''}.`;
}

function aName(n: string): string {
  return `${aOrAn(n)} ${n.toLowerCase()}`;
}

export function sellAsset(x: Ctx, id: string, fraction = 1): string {
  const c = x.c;
  const a = c.assets.find((q) => q.id === id);
  if (!a) return 'No such asset.';
  const def = ASSET_BY_ID[a.typeId];
  if (def?.notForSale && a.typeId !== 'territory') return 'This cannot be sold.';
  if (a.seized) return 'This asset has been seized.';
  if (a.typeId === 'territory') return 'Territory comes with the office.';
  const portion = def?.cat === 'investment' ? Math.max(0, Math.min(1, fraction)) : 1;
  const gross = Math.round(a.value * portion);
  const debt = Math.round(a.mortgage * portion);
  const net = gross - debt;
  x.money(Math.max(0, net));
  if (net < 0) c.debt += -net;
  if (portion >= 1) c.assets = c.assets.filter((q) => q !== a);
  else {
    a.value -= gross;
    a.purchasePrice *= 1 - portion;
    a.mortgage -= debt;
  }
  const gain = gross - a.purchasePrice * (portion >= 1 ? 1 : 0);
  return `Sold ${portion < 1 ? `${Math.round(portion * 100)}% of ` : ''}${a.name.toLowerCase()} for ${x.fmt(gross)}${debt ? ` (paid off ${x.fmt(debt)} mortgage)` : ''}.${portion >= 1 && gain > 0 ? ` Profit: ${x.fmt(gain)}.` : ''}`;
}

export function developAsset(x: Ctx, id: string): string {
  const a = x.c.assets.find((q) => q.id === id);
  const def = a && ASSET_BY_ID[a.typeId];
  if (!a || !def?.developable) return 'This cannot be developed.';
  const cost = Math.round(a.value * 0.25);
  if (!x.spend(cost)) return `Development costs ${x.fmt(cost)}.`;
  a.level++;
  a.value = Math.round(a.value * 1.32);
  a.condition = Math.min(100, a.condition + 20);
  x.train('propertyDevelopment', 4);
  return `You expanded ${a.name.toLowerCase()} to level ${a.level}${a.typeId === 'restaurant' ? ` (${a.level} locations)` : ''}. Value now ${x.fmt(a.value)}.`;
}

export function toggleRent(x: Ctx, id: string): string {
  const a = x.c.assets.find((q) => q.id === id);
  if (!a || !ASSET_BY_ID[a.typeId]?.rentable) return 'You cannot rent that out.';
  a.rentedOut = !a.rentedOut;
  return a.rentedOut ? `You found tenants for ${a.name.toLowerCase()}.` : `You took ${a.name.toLowerCase()} off the rental market.`;
}

export function renovate(x: Ctx, id: string): string {
  const a = x.c.assets.find((q) => q.id === id);
  if (!a) return 'No such asset.';
  const cost = Math.round(a.value * 0.05);
  if (!x.spend(cost)) return `Renovation costs ${x.fmt(cost)}.`;
  a.condition = 100;
  a.value = Math.round(a.value * 1.04);
  return `Renovated ${a.name.toLowerCase()}.`;
}

/** Yearly asset simulation: values follow the world economy; income, upkeep, mortgages, failures. */
export function assetsTick(x: Ctx): void {
  const c = x.c;
  let income = 0;
  for (const a of [...c.assets]) {
    const def = ASSET_BY_ID[a.typeId];
    if (!def || a.seized) continue;
    const w = x.s.world.contexts[a.countryId] ?? x.w;
    const econ = (w.economy - 50) / 400 + w.econShock / 300;
    // Value movement.
    if (a.typeId === 'crypto') {
      let r = x.float(-0.75, 1.1);
      if (x.chance(0.06)) {
        r = -0.85;
        x.log('💥 Your crypto exchange collapsed. Most of your coins are gone.', 'bad');
      }
      a.value = Math.max(0, Math.round(a.value * (1 + r)));
    } else if (a.typeId === 'techStartup') {
      if (x.chance(0.24)) {
        x.log(`💸 ${a.name} failed. Your stake is worthless.`, 'bad');
        c.assets = c.assets.filter((q) => q !== a);
        x.mods({ happiness: -10, stress: 8 });
        x.remember('startupFailed', 'Watched a startup fail', 15);
        continue;
      }
      if (x.chance(0.06 + x.skill('entrepreneurship') / 1500)) {
        const mult = x.int(10, 100);
        const exit = a.value * mult;
        x.money(exit);
        x.log(`🚀 ${a.name} was acquired! Your stake paid out ${x.fmt(exit)} (${mult}×).`, 'major');
        x.mods({ happiness: 25, fame: 8, ego: 6 });
        x.remember('startupExit', `Sold a startup for ${x.fmt(exit)}`, 60);
        c.assets = c.assets.filter((q) => q !== a);
        continue;
      }
      a.value = Math.round(a.value * x.float(0.9, 1.6));
      x.train('entrepreneurship', 3);
    } else {
      a.value = Math.max(0, Math.round(a.value * (1 + def.appreciation + econ + x.float(-def.volatility, def.volatility) - (a.condition < 50 ? 0.03 : 0))));
    }
    // Income.
    let inc = 0;
    const condition = a.condition / 100;
    if (def.rentable) {
      if (a.rentedOut) {
        inc = a.value * def.yield * condition * (x.chance(0.12) ? 0.3 : 1);
        a.condition = Math.max(10, a.condition - x.int(1, 6));
      }
    } else if (def.yield > 0) {
      const mgmt = 0.7 + (x.skill('management') + x.skill('hospitality') + x.skill('entrepreneurship')) / 400;
      inc = a.value * def.yield * condition * mgmt * (1 + (a.level - 1) * 0.2);
      if (a.typeId === 'armsManufacturing') inc *= w.war === 'world' ? 3 : w.war === 'major' ? 2 : w.war === 'regional' ? 1.4 : 0.8;
      if (a.typeId === 'casino' && c.crime.orgName) inc *= 1.2;
      a.condition = Math.max(10, a.condition - x.int(1, 4));
    }
    if (a.typeId === 'stocks') inc = a.value * def.yield;
    if (a.typeId === 'territory') {
      inc = 120000 * a.level * (w.economy / 50);
      if (w.stability < 30 && x.chance(0.15)) x.queue('rebellion');
    }
    if (a.typeId === 'mediaCompany') x.mod('fame', 1);
    if (a.typeId === 'privateIsland') x.mods({ happiness: 2 });
    if (def.heat) x.mod('heat', def.heat);
    const upkeep = a.value * def.upkeep + (def.fixedCost ?? 0);
    income += inc - upkeep;
    // Mortgage: 6% interest plus principal.
    if (a.mortgage > 0) {
      const payment = Math.round(a.mortgage * 0.06 + Math.min(a.mortgage, a.purchasePrice * 0.035));
      if (!x.spend(payment)) {
        a.meta.missed = ((a.meta.missed as number) || 0) + 1;
        if ((a.meta.missed as number) >= 2) {
          c.assets = c.assets.filter((q) => q !== a);
          x.log(`🏚️ The bank foreclosed on ${a.name.toLowerCase()}.`, 'bad');
          x.mods({ happiness: -12, stress: 10 });
          continue;
        }
      } else {
        a.mortgage = Math.max(0, Math.round(a.mortgage - Math.min(a.mortgage, a.purchasePrice * 0.035)));
        a.meta.missed = 0;
      }
    }
    // Hostile governments seize assets.
    if (w.regimeOverride === 'junta' && c.money + a.value > 5000000 && x.chance(0.04)) {
      a.seized = true;
      x.log(`🚫 The junta seized your ${a.name.toLowerCase()}.`, 'bad');
    }
    // Incidents become events.
    if (a.typeId === 'nightclub' && x.chance(0.12)) x.queue('nightclub_incident', { assetId: a.id });
    if (a.typeId === 'restaurant' && x.chance(0.06)) x.queue('food_scandal', { assetId: a.id });
    if (def.rentable && a.rentedOut && x.chance(0.07)) x.queue('tenant_trouble', { assetId: a.id });
    if (a.typeId === 'armsManufacturing' && w.war !== 'none' && x.chance(0.08)) x.queue('war_crimes_exposure', { assetId: a.id });
  }
  if (income >= 0) x.money(income);
  else if (!x.spend(-income)) {
    c.debt += -income - Math.max(0, c.money);
    c.money = 0;
  }
}

export function availableAssets(x: Ctx): AssetDef[] {
  return ASSETS.filter((d) => x.year >= d.fromYear && !d.notForSale);
}

export function assetIncomeEstimate(a: Asset): number {
  const def = ASSET_BY_ID[a.typeId];
  if (!def) return 0;
  if (def.rentable) return a.rentedOut ? Math.round(a.value * def.yield * (a.condition / 100)) : 0;
  return Math.round(a.value * def.yield * (a.condition / 100) * (1 + (a.level - 1) * 0.2));
}
