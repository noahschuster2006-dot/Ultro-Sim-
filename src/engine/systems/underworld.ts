import type { Ctx } from '../ctx';
import { DRUGS, DRUG_BY_ID, OPS, OP_BY_ID, ORG_RANKS, SUPPLY_STAGES } from '../data/underworld';
import { ORG_NAMES } from '../data/names';
import { ASSET_BY_ID } from '../data/assets';
import type { Operation } from '../types';
import { makeNpc } from './npcs';
import { openCase } from './legal';
import { expose } from './addiction';

export function drugName(id: string, year: number): string {
  const d = DRUG_BY_ID[id];
  if (!d) return id;
  if (d.eraName) for (const [until, n] of d.eraName) if (year <= until) return n;
  return d.name;
}

export function canJoinOrg(x: Ctx): true | string {
  const c = x.c;
  if (c.crime.orgName) return `You are already in ${c.crime.orgName}`;
  if (c.age < 14) return 'Too young';
  if (c.legal.witnessProtection) return 'You are in witness protection';
  if (x.stat('streetCred') < 12 && x.stat('criminalRep') < 10 && !c.career?.careerId.match(/thief|drugDealer|hitman|smuggler|conArtist|bootlegger|pirate/)) return 'Nobody in the underworld knows you yet (street cred 12+)';
  return true;
}

/** Joining an organization starts the long mafia consequence chain. */
export function joinOrg(x: Ctx): string {
  const ok = canJoinOrg(x);
  if (ok !== true) return ok;
  const c = x.c;
  const name = x.pick(ORG_NAMES);
  c.crime.orgName = name;
  c.crime.orgRank = 0;
  c.crime.orgLoyalty = 50;
  c.crime.rivalOrgs = [x.pick(ORG_NAMES.filter((n) => n !== name))];
  c.flags.criminalContact = true;
  const handler = makeNpc(x, { age: x.int(30, 55), karma: -40, criminal: 70, aggression: 60 });
  x.addRel(handler.id, 'handler', { affinity: 45, trust: 40 });
  const boss = makeNpc(x, { age: x.int(45, 70), karma: -60, criminal: 90, aggression: 55, wealth: 3000000 });
  x.addRel(boss.id, 'acquaintance', { affinity: 30, trust: 20, meta: { orgBoss: true } });
  x.chain('mafia', 1, { org: name, handler: handler.id, boss: boss.id });
  x.mods({ streetCred: 8, criminalRep: 8, karma: -5 });
  x.remember('joinedOrg', `Joined ${name}`, 55);
  return `You were initiated into ${name}. ${x.name(handler)} will be your handler. There is no leaving.`;
}

export function orgRankName(rank: number): string {
  return ORG_RANKS[Math.max(0, Math.min(ORG_RANKS.length - 1, rank))];
}

/** Demand multiplier: the underground economy responds to world events. */
export function demand(x: Ctx, kind: string, product: string): number {
  const w = x.w;
  let m = 1 + (50 - w.economy) / 150;
  if (kind === 'drugs') {
    if (product === 'liquor') m *= w.prohibition ? 4 : 0.25;
    if (product === 'cannabis' && w.cannabisLegal) m *= 0.15;
    if (x.w.policies.includes('crackdown')) m *= 1.2;
  }
  if (kind === 'weapons') {
    m *= w.war === 'world' ? 3 : w.war === 'major' ? 2.2 : w.war === 'regional' ? 1.6 : 1;
    if (w.sanctions > 0) m *= 1.5;
    if (Object.values(x.s.world.contexts).some((c) => c.war !== 'none')) m *= 1.2;
  }
  if (kind === 'smuggling' && product === 'refugees') m *= w.war !== 'none' || w.stability < 30 ? 2 : 0.6;
  return m;
}

export function operationIncome(x: Ctx, op: Operation): number {
  let base: number;
  let skill: number;
  if (op.kind === 'drugs') {
    const st = SUPPLY_STAGES.find((s) => s.id === op.stage)!;
    const drug = DRUG_BY_ID[op.product];
    base = st.baseIncome * (drug.price / 50) * (1 + st.margin);
    skill = x.skill(st.skill);
  } else {
    const def = OP_BY_ID[op.kind];
    const prod = def?.products.find((p) => p.id === op.product);
    base = (def?.baseIncome ?? 30000) * (prod?.mult ?? 1);
    skill = x.skill(def?.skill ?? 'streetwise');
  }
  return Math.round(base * op.scale * demand(x, op.kind, op.product) * (0.6 + skill / 125) * (1 + x.c.crime.orgRank * 0.15));
}

export function startOperation(x: Ctx, kind: string, product: string, stage?: string): string {
  const c = x.c;
  if (c.legal.prison) return 'Not from a cell.';
  if (c.crime.operations.length >= 2 + c.crime.orgRank) return `Your rank (${orgRankName(c.crime.orgRank)}) cannot manage more operations.`;
  if (kind === 'drugs') {
    const drug = DRUG_BY_ID[product];
    const st = SUPPLY_STAGES.find((s) => s.id === stage);
    if (!drug || !st) return 'Unknown drug operation.';
    if (x.year < drug.fromYear) return 'That drug does not exist yet.';
    if (c.crime.operations.some((o) => o.kind === 'drugs' && o.product === product && o.stage === stage)) return 'You already run that operation.';
    const minRank = st.id === 'street' ? 0 : st.id === 'production' ? 1 : 2;
    if (c.crime.orgRank < minRank && !c.career?.careerId.match(/drugKingpin|bootlegger/)) return `Requires rank ${orgRankName(minRank)}.`;
    c.crime.operations.push({ id: x.uid('op'), kind: 'drugs', product, stage: st.id, scale: 1, years: 0, lastIncome: 0 });
    x.train(st.skill, 4);
    x.mods({ karma: -3, criminalRep: 3 });
    return `You set up a ${drugName(product, x.year).toLowerCase()} ${st.name.toLowerCase()} operation.`;
  }
  const def = OP_BY_ID[kind];
  const prod = def?.products.find((p) => p.id === product);
  if (!def || !prod) return 'Unknown operation.';
  if (x.year < def.fromYear || (prod.fromYear && x.year < prod.fromYear)) return 'Not possible in this era.';
  if (c.crime.orgRank < def.minRank && !(kind === 'cyber' && x.skill('hacking') >= 30)) return `Requires rank ${orgRankName(def.minRank)}.`;
  if (c.crime.operations.some((o) => o.kind === kind && o.product === product)) return 'You already run that operation.';
  c.crime.operations.push({ id: x.uid('op'), kind: kind as Operation['kind'], product, stage: 'run', scale: 1, years: 0, lastIncome: 0 });
  x.mods({ karma: prod.karma / 2, criminalRep: 3 });
  x.train(def.skill, 4);
  return `You launched: ${prod.name}.`;
}

export function scaleOperation(x: Ctx, opId: string, delta: number): string {
  const op = x.c.crime.operations.find((o) => o.id === opId);
  if (!op) return 'No such operation.';
  op.scale = Math.max(1, Math.min(5, op.scale + delta));
  return `Operation scaled to level ${op.scale}.`;
}

export function shutOperation(x: Ctx, opId: string): string {
  x.c.crime.operations = x.c.crime.operations.filter((o) => o.id !== opId);
  return 'You shut the operation down and scattered the crew.';
}

/** Yearly underground economy: income, heat, evidence and rival pressure. */
export function underworldTick(x: Ctx): void {
  const c = x.c;
  if (c.legal.prison) {
    if (c.crime.operations.length && x.chance(0.5)) {
      const lost = c.crime.operations.pop()!;
      x.log(`With you locked up, your ${lost.kind} operation was taken over by rivals.`, 'bad');
    }
    return;
  }
  let total = 0;
  for (const op of c.crime.operations) {
    op.years++;
    const inc = operationIncome(x, op);
    op.lastIncome = inc;
    total += inc;
    let risk: number;
    let karma = 0;
    if (op.kind === 'drugs') {
      const st = SUPPLY_STAGES.find((s) => s.id === op.stage)!;
      risk = st.risk * DRUG_BY_ID[op.product].risk;
      karma = -3;
    } else {
      const def = OP_BY_ID[op.kind];
      const prod = def?.products.find((p) => p.id === op.product);
      risk = def?.risk ?? 1;
      karma = prod?.karma ?? -3;
      if (op.product === 'nuclear') risk *= 3;
    }
    if (x.w.policies.includes('crackdown')) risk *= 1.5;
    let heat = risk * op.scale * 4 * (c.flags.mobCounsel ? 0.5 : 1);
    x.mod('heat', heat);
    x.mods({ karma: karma * 0.6, sin: karma < 0 ? 1 : 0 });
    if (x.chance(Math.min(0.5, (x.stat('heat') / 300) * risk))) {
      const crime = op.kind === 'drugs' ? 'drugDealing' : op.kind === 'weapons' ? 'weaponsTrafficking' : op.kind === 'cyber' ? 'cyberFraud' : op.kind === 'smuggling' ? 'smuggling' : 'extortion';
      openCase(x, crime, { label: `${op.kind} operation` });
      heat = 0;
    }
  }
  if (total > 0) {
    c.crime.dirtyMoney += total;
    x.mod('criminalRep', 1 + c.crime.operations.length);
  }
  // Organization dynamics.
  if (c.crime.orgName) {
    c.crime.orgLoyalty = Math.max(0, Math.min(100, c.crime.orgLoyalty + x.float(-3, 2)));
    const needRep = [0, 25, 40, 55, 70, 82, 92][c.crime.orgRank + 1] ?? 999;
    if (c.crime.orgRank < ORG_RANKS.length - 1 && x.stat('criminalRep') >= needRep && c.crime.orgLoyalty >= 40 && x.chance(0.35)) {
      c.crime.orgRank++;
      x.log(`🩸 You rose to ${orgRankName(c.crime.orgRank)} in ${c.crime.orgName}.`, 'major');
      x.mods({ fear: 8, streetCred: 6, ego: 4 });
      if (c.crime.orgRank >= 3) c.crime.territory += x.int(2, 6);
      if (c.crime.orgRank >= 4) {
        x.remember('crimeBoss', `Became ${orgRankName(c.crime.orgRank)} of ${c.crime.orgName}`, 70);
        expose(x, 'power', 0.8);
      }
    }
    // Rival wars over territory.
    if (c.crime.territory > 0 && x.chance(0.12 + x.w.crimeRate / 500) && !x.queued('rival_war')) x.queue('rival_war', { rival: x.pick(c.crime.rivalOrgs.length ? c.crime.rivalOrgs : ORG_NAMES) });
  }
}

// ---------------------------------------------------------------- laundering

export interface LaunderMethod {
  id: string;
  name: string;
  layer: 1 | 2 | 3;
  cost: number;
  desc: string;
  fromYear: number;
}

/** Placement → layering → integration. Each layer costs 5–20% but cleans better. */
export const LAUNDER_METHODS: LaunderMethod[] = [
  { id: 'cash', name: 'Smurfing & casino chips', layer: 1, cost: 0.05, desc: 'Placement: small cash deposits and casino chips. Cheap, easily traced.', fromYear: -800 },
  { id: 'front', name: 'Through a front business', layer: 2, cost: 0.08, desc: 'Run dirty cash through a business you own. Capacity limited by your fronts.', fromYear: -800 },
  { id: 'realEstate', name: 'Real-estate flips', layer: 2, cost: 0.1, desc: 'Buy and sell property with dirty money.', fromYear: -800 },
  { id: 'shell', name: 'Shell companies', layer: 2, cost: 0.12, desc: 'Layering through a maze of paper companies.', fromYear: 1850 },
  { id: 'crypto', name: 'Crypto mixing', layer: 2, cost: 0.1, desc: 'Tumble coins through mixers. Blockchain tracing is a skill challenge.', fromYear: 2014 },
  { id: 'offshore', name: 'Offshore banking', layer: 3, cost: 0.18, desc: 'Integration via tax-haven accounts. Requires political connections.', fromYear: 1920 },
];

export function launderCapacity(x: Ctx, method: string): number {
  const c = x.c;
  if (method === 'front') return Math.round(c.assets.filter((a) => !a.seized).reduce((t, a) => t + a.value * (ASSET_BY_ID[a.typeId]?.launder ?? 0), 0));
  if (method === 'cash') return 15000 + x.skill('moneyLaundering') * 600;
  if (method === 'realEstate') return 400000 + x.skill('moneyLaundering') * 8000;
  return Number.MAX_SAFE_INTEGER;
}

export function launderAvailable(x: Ctx, m: LaunderMethod): true | string {
  if (x.year < m.fromYear) return 'Not available in this era';
  if (m.id === 'front' && launderCapacity(x, 'front') <= 0) return 'You own no front businesses';
  if (m.id === 'shell' && x.skill('shellCompanies') < 15 && x.skill('moneyLaundering') < 30) return 'Requires shell companies 15+ or money laundering 30+';
  if (m.id === 'offshore' && (x.skill('offshoreBanking') < 15 || (x.stat('corruption') < 25 && !x.c.assets.some((a) => a.countryId === 'ky' || a.countryId === 'ch')))) return 'Requires offshore banking 15+ and political connections (corruption 25+)';
  return true;
}

export function launder(x: Ctx, methodId: string, amount: number): string {
  const c = x.c;
  const m = LAUNDER_METHODS.find((l) => l.id === methodId);
  if (!m) return 'Unknown method.';
  const ok = launderAvailable(x, m);
  if (ok !== true) return ok;
  const amt = Math.min(amount, c.crime.dirtyMoney, launderCapacity(x, methodId));
  if (amt <= 0) return 'Nothing to launder.';
  let cost = m.cost * (x.flag('combo_forensic') ? 0.7 : 1);
  if (methodId === 'crypto') cost += Math.max(0, 0.05 - x.skill('blockchain') / 1000);
  c.crime.dirtyMoney -= amt;
  const clean = Math.round(amt * (1 - cost));
  if (methodId === 'offshore') c.crime.offshore += clean;
  else x.money(clean);
  x.train('moneyLaundering', 3);
  if (methodId === 'shell') x.train('shellCompanies', 3);
  if (methodId === 'offshore') x.train('offshoreBanking', 3);
  c.crime.launderStage = Math.max(c.crime.launderStage, m.layer);
  // Financial intelligence units trace poorly laundered funds.
  const trace = (0.3 / m.layer) * (1 - x.skill('moneyLaundering') / 150) * (amt > 250000 ? 1.5 : 1) * (methodId === 'crypto' ? 1 - x.skill('blockchain') / 120 : 1);
  let text = `Laundered ${x.fmt(amt)} → ${x.fmt(clean)} clean${methodId === 'offshore' ? ' (offshore)' : ''}.`;
  if (x.chance(trace)) {
    openCase(x, 'moneyLaundering', { mult: 1 + amt / 500000 });
    text += ' A financial intelligence unit flagged the transactions.';
  }
  return text;
}

export function repatriateOffshore(x: Ctx, amount: number): string {
  const amt = Math.min(amount, x.c.crime.offshore);
  if (amt <= 0) return 'Your offshore accounts are empty.';
  x.c.crime.offshore -= amt;
  x.money(amt * 0.97);
  return `Moved ${x.fmt(amt)} home from offshore accounts.`;
}

export { DRUGS, OPS, SUPPLY_STAGES };
